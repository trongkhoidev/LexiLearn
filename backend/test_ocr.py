import sys
import os
import time
import io
import fitz # PyMuPDF
from PIL import Image

# Add backend to path to import functions
sys.path.append(os.path.join(os.getcwd(), 'backend'))
from app import ocr_page_task, preprocess_image

def test_single_page_ocr(pdf_path, page_num=0):
    print(f"Testing OCR on {pdf_path}, page {page_num}...")
    doc = fitz.open(pdf_path)
    page = doc[page_num]
    
    # OLD method (approximate)
    start_time = time.time()
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
    img_data = pix.tobytes("png")
    img = Image.open(io.BytesIO(img_data))
    import pytesseract
    old_text = pytesseract.image_to_string(img)
    old_duration = time.time() - start_time
    print(f"Old method took: {old_duration:.2f}s")
    
    # NEW method
    start_time = time.time()
    _, new_text = ocr_page_task(page_num, img_data)
    new_duration = time.time() - start_time
    print(f"New method (with preprocessing) took: {new_duration:.2f}s")
    
    print(f"Speed change: {((old_duration - new_duration) / old_duration) * 100:.1f}%")
    print(f"Text extracted length: {len(new_text)}")
    
    # Look for "TEST" or "PASSAGE" bits
    if "PASSAGE" in new_text.upper() or "TEST" in new_text.upper():
        print("Verification: Found key keywords in OCR output! ✅")
    else:
        print("Verification: Keywords not found, check OCR quality. ⚠️")

if __name__ == "__main__":
    pdf = "/Users/admin/Development/LexiLearn/Cambridge 14 PDF.pdf"
    if os.path.exists(pdf):
        test_single_page_ocr(pdf, 10) # Test page 11 (often contains text in these scans)
    else:
        print(f"File not found: {pdf}")
