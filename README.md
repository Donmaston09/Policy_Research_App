# Policy Research App

An AI-powered policy analysis web app that helps researchers, students, and practitioners turn uploaded documents or pasted findings into structured SMART policy recommendations.

## Overview

Policy Research App lets you:

- Upload research documents such as PDF, DOC, DOCX, TXT, RTF, and Markdown files
- Extract document text directly into the findings workspace
- Paste or edit findings before analysis
- Generate structured policy recommendations using AI
- Export results as JSON, Markdown, TXT, or DOCX
- Copy findings and generated output to the clipboard
- Print or save results as PDF from the browser

The app is built with:

- FastAPI
- HTML, CSS, and vanilla JavaScript
- `pypdf` and `pdfminer.six` for PDF text extraction
- `python-docx` for DOCX parsing

## Features

- Drag-and-drop file upload
- Upload progress feedback for large files
- Side-by-side findings and results layout
- AI provider selection
- Structured SMART recommendation output
- Copy-to-clipboard tools
- Export and print support
- Simple deployment on Render

## Supported File Types

The upload parser supports:

- `.pdf`
- `.doc`
- `.docx`
- `.txt`
- `.rtf`
- `.md`

Note: scanned or image-only PDFs may not contain selectable text and may require OCR before the app can extract content.

## How It Works

1. Upload a document or paste findings manually.
2. The app extracts text and places it in the findings box.
3. Review and edit the extracted text if needed.
4. Choose your AI provider and enter your API key.
5. Generate SMART policy recommendations.
6. Copy, download, print, or save the results.

## Project Structure


## Local Setup

### 1. Clone the repository
git clone <your-repo-url>
cd Policy_Research_App

### 2. Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate

### 3. Install dependencies
pip install -r requirements.txt

### 4. Run the app
python3 main.py
Or run with Uvicorn directly:

uvicorn main:app --reload

### 5. Open in your browser
http://127.0.0.1:8000

```text
.
├── main.py
├── requirements.txt
├── render.yaml
├── static/
│   ├── index.html
│   ├── main.js
│   └── style.css
└── nlpHelper.js


