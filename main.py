import os
import io
import shutil
import subprocess
import tempfile
import requests
from google import genai  # Updated to the new 2026 SDK
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import docx
from pdfminer.high_level import extract_text
from pypdf import PdfReader

# --- Creator and Fundraiser Metadata ---
CREATOR_INFO = {
    "name": "Tony Onoja",
    "affiliation": "School of Health Sciences, University of Surrey, UK",
    "email": "donmaston09@gmail.com",
    "support_cause": "I am raising funds for IDP displaced children of genocide in the Middle Belt Nigeria to have access to computer literacy and education.",
    "paypal": "https://paypal.me/Onoja412"
}

app = FastAPI(
    title="Policy Engine API", 
    description=f"Developed by {CREATOR_INFO['name']} ({CREATOR_INFO['affiliation']})",
    version="1.0.0"
)

# 1. CORS Middleware for Production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure static directory exists
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
SUPPORTED_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt", ".rtf", ".md"}

@app.get("/")
async def serve_frontend():
    """Serves the main index.html file."""
    return FileResponse("static/index.html")

@app.get("/api/about")
async def get_about():
    """Returns creator information and support links."""
    return CREATOR_INFO

# --- File Parsing Logic ---
def normalize_extracted_text(text: str) -> str:
    lines = [line.rstrip() for line in text.splitlines()]
    cleaned = []
    previous_blank = False

    for line in lines:
        is_blank = not line.strip()
        if is_blank and previous_blank:
            continue
        cleaned.append(line)
        previous_blank = is_blank

    return "\n".join(cleaned).strip()


def extract_word_text_with_textutil(contents: bytes, suffix: str) -> str:
    if not shutil.which("textutil"):
        raise RuntimeError("Legacy Word extraction is not available on this machine")

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_input:
        tmp_input.write(contents)
        input_path = tmp_input.name

    try:
        result = subprocess.run(
            ["textutil", "-convert", "txt", "-stdout", input_path],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or "textutil conversion failed")
        return result.stdout
    finally:
        if os.path.exists(input_path):
            os.remove(input_path)


def extract_upload_text(filename: str, contents: bytes) -> str:
    _, ext = os.path.splitext(filename.lower())

    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported format. Use PDF, DOC, DOCX, TXT, RTF, or MD.",
        )

    if ext == ".pdf":
        raw_text = ""

        try:
            reader = PdfReader(io.BytesIO(contents))
            raw_text = "\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception:
            raw_text = ""

        if not normalize_extracted_text(raw_text):
            raw_text = extract_text(io.BytesIO(contents))
    elif ext == ".docx":
        doc = docx.Document(io.BytesIO(contents))
        raw_text = "\n".join([p.text for p in doc.paragraphs])
    elif ext in {".doc", ".rtf"}:
        raw_text = extract_word_text_with_textutil(contents, ext)
    else:
        raw_text = contents.decode("utf-8", errors="ignore")

    text = normalize_extracted_text(raw_text)
    if not text:
        raise HTTPException(
            status_code=422,
            detail="The uploaded file was read, but no extractable text was found. If this is a scanned PDF, it may need OCR before it can appear in the findings box.",
        )
    return text


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded file is empty")
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File is too large. Please keep uploads under 15 MB.")

    try:
        text = extract_upload_text(file.filename, contents)
        _, ext = os.path.splitext(file.filename.lower())
        return {
            "text": text,
            "filename": file.filename,
            "filetype": ext.lstrip("."),
            "characters": len(text),
            "ready": True,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parsing error: {str(e)}")

# --- Generation Logic ---
class GenerateRequest(BaseModel):
    findings: str
    provider: str
    key: str

@app.post("/api/generate")
async def generate(req: GenerateRequest):
    if not req.key:
        return {"error": "API Key is required"}

    system_prompt = (
        "You are a senior policy analyst. Based on the provided research findings, "
        "produce SMART recommendations. Return them EXACTLY as JSON matching the "
        "following shape, ensuring you strictly follow the requested textual format.\n"
        "Shape: {\"recommendations\": [{\"title\": \"Recommendation One\", \"label\": \"Priority Level\", "
        "\"body\": \"The actionable recommendation explicitly specifying who carries out the assignment (e.g., 'The Federal Government of Nigeria should...'). Keep this concise.\", "
        "\"strategies\": [{\"num\": \"i.\", \"text\": \"The specific actor (e.g. 'The Minister of X') to do [action] by [time].\"}]}]}.\n"
        "Important Constraints:\n"
        "1. DO NOT wrap the output in markdown code blocks (e.g. ```json). Return raw JSON only.\n"
        "2. 'title' must be sequentially named (e.g., Recommendation One, Recommendation Two).\n"
        "3. 'body' must be the actionable recommendation itself, explicitly specifying who is to carry out the assignment.\n"
        "4. 'strategies' must be an array of objects. Each object provides a 'num' formatted as a roman numeral (i., ii., iii.) "
        "and 'text' which is the literal strategy text.\n"
        "5. Strategies must incorporate SMART principles directly within the sentence naturally. CRITICALLY, each strategy MUST explicitly assign responsibilities to specific Ministries, MDAs, Ministers, or Departments to implement the recommendation. Also include timelines (e.g., 'by Q4 2026'). Do NOT add bracketed tags or smart_tags arrays.\n"
        "6. If the provided findings are completely unrelated to policy or actionable research, return an empty 'recommendations' array [].\n"
        "Return RAW JSON only."
    )

    # --- Gemini Implementation (Using New SDK) ---
    if req.provider == 'gemini':
        try:
            client = genai.Client(api_key=req.key)
            # Utilizing the latest Gemini Flash model
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=f"{system_prompt}\n\nFindings: {req.findings}",
                config={'response_mime_type': 'application/json'}
            )
            return {
                "recs": response.text, 
                "pillText": "Gemini 3 Flash", 
                "pillClass": "ai"
            }
        except Exception as e:
            return {"error": f"Gemini Error: {str(e)}"}

    # --- OpenAI Implementation ---
    elif req.provider == 'openai':
        try:
            headers = {'Authorization': f'Bearer {req.key}'}
            payload = {
                "model": "gpt-4o",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Findings: {req.findings}"}
                ],
                "response_format": {"type": "json_object"}
            }
            r = requests.post(
                'https://api.openai.com/v1/chat/completions',
                headers=headers,
                json=payload,
                timeout=90
            )
            r.raise_for_status()
            data = r.json()
            if "error" in data:
                return {"error": data["error"]["message"]}
            return {
                "recs": data['choices'][0]['message']['content'], 
                "pillText": "GPT-4o", 
                "pillClass": "ai"
            }
        except Exception as e:
            return {"error": f"OpenAI Error: {str(e)}"}

    else:
        # Local Fallback
        mock_fallback = {
            "recommendations": [{
                "title": "Recommendation One",
                "label": "Baseline Analysis",
                "body": "Analysis generated locally. Please provide an API key for advanced AI features.",
                "strategies": [{"num": "i.", "text": "Enter an API key to enable cloud-based LLM analysis."}]
            }]
        }
        return {"recs": mock_fallback, "pillText": "Local Engine", "pillClass": "nlp"}

# --- Production Entry Point ---
if __name__ == "__main__":
    import uvicorn
    # Automatically detects port from environment (Render/Railway) or defaults to 8000
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
