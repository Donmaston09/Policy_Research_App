document.addEventListener('DOMContentLoaded', () => {
    const findingsInput = document.getElementById('findings-input');
    const fileUpload = document.getElementById('file-upload');
    const dropzone = document.getElementById('dropzone');
    const uploadStatus = document.getElementById('upload-status');
    const selectedFile = document.getElementById('selected-file');
    const uploadProgressWrap = document.getElementById('upload-progress-wrap');
    const uploadProgressBar = document.getElementById('upload-progress-bar');
    const uploadProgressText = document.getElementById('upload-progress-text');
    const apiProvider = document.getElementById('api-provider');
    const apiKey = document.getElementById('api-key');
    const copyFindingsBtn = document.getElementById('copy-findings-btn');

    const generateBtn = document.getElementById('generate-btn');
    const btnText = document.querySelector('.btn-text');
    const spinner = document.querySelector('.spinner');

    const resultsSection = document.getElementById('results-section');
    const resultsContent = document.getElementById('results-content');
    const modelBadge = document.getElementById('model-badge');
    const copyResultsBtn = document.getElementById('copy-results-btn');
    const downloadJsonBtn = document.getElementById('download-json-btn');
    const downloadMdBtn = document.getElementById('download-md-btn');
    const downloadTxtBtn = document.getElementById('download-txt-btn');
    const downloadDocxBtn = document.getElementById('download-docx-btn');
    const printPdfBtn = document.getElementById('print-pdf-btn');

    let latestResult = null;
    let latestResultFormat = 'markdown';

    const setUploadStatus = (message, tone = 'idle') => {
        uploadStatus.textContent = message;
        uploadStatus.dataset.state = tone;
    };

    const setSelectedFile = (message, tone = 'idle') => {
        selectedFile.textContent = message;
        selectedFile.dataset.state = tone;
    };

    const setUploadProgress = (percent, message = 'Uploading...') => {
        uploadProgressWrap.classList.remove('hidden');
        uploadProgressBar.style.width = `${Math.max(0, Math.min(percent, 100))}%`;
        uploadProgressText.textContent = message;
    };

    const hideUploadProgress = () => {
        uploadProgressWrap.classList.add('hidden');
        uploadProgressBar.style.width = '0%';
        uploadProgressText.textContent = 'Uploading...';
    };

    const formatCount = (count) => `${count.toLocaleString()} characters extracted`;

    const escapeHtml = (value = '') => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const normalizeRecommendations = (input) => {
        if (Array.isArray(input)) return input;
        if (Array.isArray(input?.recommendations)) return input.recommendations;
        return null;
    };

    const slugify = (value) => (value || 'policy-strategy')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'policy-strategy';

    const buildMarkdown = (recommendations) => recommendations.map((rec) => {
        const strategies = (rec.strategies || []).map((strategy) => {
            const num = strategy.num ? `${strategy.num}` : 'i.';
            return `${num} ${strategy.text}`;
        }).join('\n');

        return [
            `## ${rec.title || 'Recommendation'}`,
            '',
            `Level: ${rec.label || 'Not specified'}`,
            '',
            rec.body || '',
            '',
            '### Implementation Strategies;',
            strategies || 'No strategies provided.'
        ].join('\n');
    }).join('\n\n');

    const buildPlainText = (recommendations) => recommendations.map((rec) => {
        const strategies = (rec.strategies || []).map((strategy) => {
            const num = strategy.num ? `${strategy.num}` : 'i.';
            return `${num}\t${strategy.text}`;
        }).join('\n');

        return [
            `${rec.title || 'Recommendation'}`,
            `Level: ${rec.label || 'Not specified'}`,
            rec.body || '',
            'Implementation Strategies;',
            strategies || 'No strategies provided.'
        ].join('\n');
    }).join('\n\n');

    const downloadFile = (filename, content, mimeType) => {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const setExportButtonsState = (enabled) => {
        [copyResultsBtn, downloadJsonBtn, downloadMdBtn, downloadTxtBtn, downloadDocxBtn, printPdfBtn].forEach((button) => {
            button.disabled = !enabled;
        });
    };

    const uploadFileWithProgress = (file) => new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload');
        xhr.responseType = 'json';

        xhr.addEventListener('loadstart', () => {
            setSelectedFile(`Selected: ${file.name}`, 'selected');
            setUploadStatus(`Uploading ${file.name}...`, 'loading');
        });

        xhr.upload.addEventListener('progress', (event) => {
            if (!event.lengthComputable) {
                setUploadProgress(25, `Uploading ${file.name}...`);
                return;
            }
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percent, `Uploading ${file.name}... ${percent}%`);
        });

        xhr.addEventListener('load', () => {
            let data = xhr.response;
            if (!data) {
                data = { detail: 'Unexpected or invalid server response during upload' };
            }
            if (xhr.status >= 200 && xhr.status < 300) {
                setUploadProgress(100, `Processing ${file.name}...`);
                resolve(data);
            } else {
                reject(new Error(data.detail || 'File upload failed'));
            }
        });

        xhr.addEventListener('error', () => {
            reject(new Error('Network error while uploading the file'));
        });

        xhr.send(formData);
    });

    const getExportName = () => slugify(latestResult?.recommendations?.[0]?.title || latestResult?.badgeText);

    const getResultsMarkdown = () => latestResultFormat === 'structured'
        ? buildMarkdown(latestResult.recommendations)
        : latestResult.markdown;

    const getResultsPlainText = () => latestResultFormat === 'structured'
        ? buildPlainText(latestResult.recommendations)
        : latestResult.markdown;

    const copyText = async (text, successMessage) => {
        try {
            await navigator.clipboard.writeText(text);
            alert(successMessage);
        } catch (error) {
            console.error('Copy failed:', error);
            alert('Copy failed. Your browser may have blocked clipboard access.');
        }
    };

    const processUpload = async (file) => {
        if (!file) return;

        findingsInput.placeholder = "Reading your document... please wait.";
        findingsInput.value = "";
        setSelectedFile(`Selected: ${file.name}`, 'selected');
        setUploadStatus(`Reading ${file.name}...`, 'loading');
        setUploadProgress(0, `Preparing ${file.name}...`);

        try {
            const data = await uploadFileWithProgress(file);
            findingsInput.value = data.text;
            findingsInput.focus();
            findingsInput.setSelectionRange(0, 0);
            setSelectedFile(`Loaded: ${data.filename}`, 'success');
            setUploadStatus(`${data.filename} processed successfully. ${formatCount(data.characters)}. You can now review or run analysis.`, 'success');
        } catch (error) {
            console.error('Upload error:', error);
            setSelectedFile(`Upload failed: ${file.name}`, 'error');
            setUploadStatus(error.message || 'Could not read the file.', 'error');
            findingsInput.value = '';
            alert(error.message || 'Could not read the file. Please ensure it is a supported format.');
        } finally {
            findingsInput.placeholder = "Paste findings here...";
            fileUpload.value = '';
            dropzone.classList.remove('is-dragover');
            setTimeout(hideUploadProgress, 500);
        }
    };

    // --- 1. HANDLE DOCUMENT UPLOADS ---
    fileUpload.addEventListener('change', async (event) => {
        await processUpload(event.target.files[0]);
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
        dropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            dropzone.classList.add('is-dragover');
        });
    });

    ['dragleave', 'dragend', 'drop'].forEach((eventName) => {
        dropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            if (eventName !== 'drop') {
                dropzone.classList.remove('is-dragover');
            }
        });
    });

    dropzone.addEventListener('drop', async (event) => {
        const file = event.dataTransfer?.files?.[0];
        await processUpload(file);
    });

    dropzone.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            fileUpload.click();
        }
    });

    // --- 2. HANDLE GENERATION ---
    generateBtn.addEventListener('click', async () => {
        const findings = findingsInput.value.trim();
        const provider = apiProvider.value;
        const key = apiKey.value.trim();

        if (!findings) {
            alert('Please upload a document or paste findings first.');
            return;
        }

        // Set Loading State
        generateBtn.disabled = true;
        btnText.textContent = 'Generating Policy Strategy...';
        spinner.classList.remove('hidden');
        resultsSection.classList.add('hidden');

        try {
            // Call your FastAPI /api/generate endpoint
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    findings: findings,
                    provider: provider,
                    key: key
                })
            });

            let data;
            try {
                data = await response.json();
            } catch (err) {
                data = { error: 'Failed to parse JSON response from server.' };
            }

            if (data.error || data.detail) {
                alert("API Error: " + (data.error || data.detail));
            } else {
                showResults(data.recs, data.pillText, data.pillClass);
            }

        } catch (error) {
            console.error('Error:', error);
            alert('Connection to server failed. Is main.py running?');
        } finally {
            generateBtn.disabled = false;
            btnText.textContent = 'Generate SMART Recommendations';
            spinner.classList.add('hidden');
        }
    });

    function showResults(text, badgeText, badgeClass) {
        if (!text) {
             text = JSON.stringify({ recommendations: [{ title: "Error", label: "System Error", body: "No generation could take place.", strategies: [] }] });
        }
        let htmlContent = '';
        try {
            let cleanText = text;
            if (typeof text === 'string') {
                cleanText = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
            }
            const parsed = typeof cleanText === 'string' ? JSON.parse(cleanText) : cleanText;
            const recommendations = normalizeRecommendations(parsed);

            if (recommendations) {
                latestResult = {
                    badgeText,
                    badgeClass,
                    recommendations,
                    raw: parsed
                };
                latestResultFormat = 'structured';
                setExportButtonsState(true);
                htmlContent = recommendations.map(rec => `
                    <div class="recommendation-card">
                        <h3>${escapeHtml(rec.title)} <span class="label">${escapeHtml(rec.label)}</span></h3>
                        <p>${escapeHtml(rec.body)}</p>
                        <h4 style="margin-top: 1rem; margin-bottom: 0.5rem; font-size: 1.05rem;">Implementation Strategies;</h4>
                        <div style="padding-left: 0.5rem;">${(rec.strategies || []).map((strategy) => `
                            <p style="margin-bottom: 0.5rem; display: flex;"><span style="margin-right: 0.5rem; font-weight: 500;">${escapeHtml(strategy.num || 'i.')}</span> <span>${escapeHtml(strategy.text)}</span></p>
                        `).join('')}</div>
                    </div>
                `).join('');
            } else {
                const fallbackText = typeof text === 'string' ? text : JSON.stringify(text, null, 2);
                latestResult = {
                    badgeText,
                    badgeClass,
                    markdown: fallbackText
                };
                latestResultFormat = 'markdown';
                setExportButtonsState(true);
                htmlContent = marked.parse(fallbackText);
            }
        } catch (e) {
            const fallbackText = typeof text === 'string' ? text : JSON.stringify(text, null, 2);
            latestResult = {
                badgeText,
                badgeClass,
                markdown: fallbackText
            };
            latestResultFormat = 'markdown';
            setExportButtonsState(true);
            htmlContent = marked.parse(fallbackText);
        }

        resultsContent.innerHTML = htmlContent;
        modelBadge.textContent = badgeText;
        modelBadge.className = 'badge ' + badgeClass;

        resultsSection.classList.remove('hidden');
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    copyFindingsBtn.addEventListener('click', async () => {
        const findings = findingsInput.value.trim();
        if (!findings) {
            alert('There are no findings to copy yet.');
            return;
        }
        await copyText(findings, 'Findings copied to clipboard.');
    });

    copyResultsBtn.addEventListener('click', async () => {
        if (!latestResult) return;
        await copyText(getResultsPlainText(), 'Generated strategy copied to clipboard.');
    });

    downloadJsonBtn.addEventListener('click', () => {
        if (!latestResult) return;
        const payload = latestResultFormat === 'structured'
            ? { recommendations: latestResult.recommendations, source: latestResult.badgeText }
            : { content: latestResult.markdown, source: latestResult.badgeText };
        const name = getExportName();
        downloadFile(`${name}.json`, JSON.stringify(payload, null, 2), 'application/json');
    });

    downloadMdBtn.addEventListener('click', () => {
        if (!latestResult) return;
        const markdown = getResultsMarkdown();
        const name = getExportName();
        downloadFile(`${name}.md`, markdown, 'text/markdown');
    });

    downloadTxtBtn.addEventListener('click', () => {
        if (!latestResult) return;
        const plainText = getResultsPlainText();
        const name = getExportName();
        downloadFile(`${name}.txt`, plainText, 'text/plain');
    });

    downloadDocxBtn.addEventListener('click', async () => {
        if (!latestResult) return;
        if (!window.docx) {
            alert('DOCX export library is not available.');
            return;
        }

        const { Document, Packer, Paragraph, TextRun, HeadingLevel } = window.docx;
        const name = getExportName();

        try {
            const paragraphs = [];
            if (latestResultFormat === 'structured') {
                latestResult.recommendations.forEach((rec) => {
                    paragraphs.push(new Paragraph({
                        text: `${rec.title || 'Recommendation'}`,
                        heading: HeadingLevel.HEADING_2
                    }));
                    paragraphs.push(new Paragraph({
                        children: [new TextRun({ text: `Level: ${rec.label || 'Not specified'}`, bold: true })]
                    }));
                    paragraphs.push(new Paragraph(rec.body || ''));
                    paragraphs.push(new Paragraph({
                        text: 'Implementation Strategies;',
                        heading: HeadingLevel.HEADING_3
                    }));
                    (rec.strategies || []).forEach((strategy) => {
                        const num = strategy.num ? `${strategy.num} ` : 'i. ';
                        paragraphs.push(new Paragraph({
                            text: `${num}${strategy.text}`
                        }));
                    });
                    paragraphs.push(new Paragraph(''));
                });
            } else {
                getResultsPlainText().split('\n').forEach((line) => {
                    paragraphs.push(new Paragraph(line));
                });
            }

            const doc = new Document({
                sections: [{ children: paragraphs }]
            });
            const blob = await Packer.toBlob(doc);
            downloadFile(`${name}.docx`, blob, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        } catch (error) {
            console.error('DOCX export failed:', error);
            alert('DOCX export failed.');
        }
    });

    printPdfBtn.addEventListener('click', () => {
        if (!latestResult) return;
        window.print();
    });

    setExportButtonsState(false);
    setSelectedFile('No document selected yet.', 'idle');
});
