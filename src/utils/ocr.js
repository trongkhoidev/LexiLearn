/* ============================================
   LexiLearn — OCR & PDF Text Extraction Utility
   ============================================
   Uses Tesseract.js (client-side OCR) and PDF.js (PDF text extraction)
   Both loaded via CDN — no API keys needed.
*/

/**
 * Extract text from an image file using Tesseract.js
 * @param {File} file - Image file (JPG/PNG)
 * @param {Function} onProgress - Progress callback (0-1)
 * @returns {Promise<string>} Extracted text
 */
export async function extractTextFromImage(file, onProgress = () => {}) {
  // Dynamically load Tesseract.js if not present
  if (!window.Tesseract) {
    await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
  }

  const worker = await window.Tesseract.createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        onProgress(m.progress);
      }
    }
  });

  const { data } = await worker.recognize(file);
  await worker.terminate();

  return cleanOCRText(data.text);
}

/**
 * Extract text from a PDF file using PDF.js
 * @param {File} file - PDF file
 * @param {Function} onProgress - Progress callback (0-1)
 * @returns {Promise<string>} Extracted text
 */
export async function extractTextFromPDF(file, onProgress = () => {}) {
  // Dynamically load PDF.js if not present
  if (!window.pdfjsLib) {
    await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs', 'module');
    // Set worker source
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';
    }
  }

  // Fallback: if pdfjsLib didn't attach to window (ESM), try import
  let pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) {
    try {
      pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs');
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';
    } catch {
      throw new Error('Could not load PDF.js. Please check your internet connection.');
    }
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  let fullText = '';

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += `\n--- Page ${i} ---\n${pageText}\n`;
    onProgress(i / totalPages);
  }

  return cleanOCRText(fullText);
}

/**
 * Clean up OCR / extracted text
 */
function cleanOCRText(text) {
  return text
    .replace(/\r\n/g, '\n')         // Normalize line endings
    .replace(/[ \t]+/g, ' ')        // Collapse multiple spaces/tabs
    .replace(/\n{3,}/g, '\n\n')     // Max 2 consecutive newlines
    .replace(/- \n/g, '')           // Fix hyphenated line breaks
    .replace(/([a-z])\n([a-z])/g, '$1 $2') // Join broken sentences
    .trim();
}

/**
 * Dynamically load a script from URL
 */
function loadScript(url, type = 'text/javascript') {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (document.querySelector(`script[src="${url}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = url;
    if (type === 'module') script.type = 'module';
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load: ${url}`));
    document.head.appendChild(script);
  });
}
