import os
import json
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS
import fitz  # PyMuPDF
import google.generativeai as genai

app = Flask(__name__)
CORS(app)

# Default Fallback Key
FALLBACK_API_KEY = "AIzaSyDv5yQ04GH5gqZqIjYGUoSHuHBn-i5O-0M"

def get_api_key():
    return os.environ.get("GEMINI_API_KEY", FALLBACK_API_KEY)

def split_into_tests(text):
    """
    Identifies test boundaries in a full book text.
    """
    import re
    # Look for "TEST 1", "TEST 2", etc.
    test_matches = list(re.finditer(r'(?i)TEST\s*[:#-]?\s*(\d+)', text))
    if not test_matches:
        return None
        
    tests_found = []
    for i in range(len(test_matches)):
        start_idx = test_matches[i].start()
        end_idx = test_matches[i+1].start() if i+1 < len(test_matches) else len(text)
        test_text = text[start_idx:end_idx]
        test_num = int(test_matches[i].group(1))
        tests_found.append({"test_num": test_num, "text": test_text})
            
    return tests_found

@app.route('/api/parse-cambridge', methods=['POST'])
def parse_cambridge():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file uploaded"}), 400
        
        file_bytes = request.files['file'].read()
        api_key = request.form.get('apiKey', get_api_key())
        
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        total_pages = doc.page_count
        print(f"Processing PDF with {total_pages} pages...")

        full_text_parts = [None] * total_pages
        ocr_tasks = []

        # 1. Extraction / OCR pass
        for i in range(total_pages):
            page = doc[i]
            page_text = page.get_text().strip()
            if len(page_text) < 150:
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                ocr_tasks.append((i, pix.tobytes("png")))
            else:
                full_text_parts[i] = page_text

        if ocr_tasks:
            with concurrent.futures.ProcessPoolExecutor(max_workers=os.cpu_count()) as executor:
                futures = {executor.submit(ocr_page_task, p_num, p_data): p_num for p_num, p_data in ocr_tasks}
                for future in concurrent.futures.as_completed(futures):
                    p_num, text = future.result()
                    full_text_parts[p_num] = text

        full_text = ""
        for i, text in enumerate(full_text_parts):
            full_text += f"\n--- Page {i + 1} ---\n{text or '[No content]'}"

        # 2. Split into tests and use AI for each
        tests_metadata = split_into_tests(full_text)
        if not tests_metadata:
             return jsonify({"error": "Could not identify any Tests in this PDF. Please ensure it is a standard Cambridge IELTS book."}), 400

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        book_structure = {
            "title": f"Cambridge IELTS (Parsed)",
            "book_num": 0,
            "tests": []
        }
        
        # Try to find book number from full text
        import re
        book_num_match = re.search(r'(?i)IELTS\s*(\d+)', full_text[:5000])
        if book_num_match:
            book_structure["book_num"] = int(book_num_match.group(1))
            book_structure["title"] = f"Cambridge IELTS {book_structure['book_num']}"

        print(f"Identified {len(tests_metadata)} tests. Calling AI for each...")
        
        for t_meta in tests_metadata[:4]: # Max 4 tests per book
            print(f"Parsing Test {t_meta['test_num']} with AI...")
            test_prompt = f"""You are an IELTS expert. Parse this text from Test {t_meta['test_num']} of a Cambridge IELTS book. 
Identify:
1. All Reading Passages (usually 3).
2. For each passage, extract the full text.
3. For each passage, extract ALL questions (MCQs, TFNG, Matching, Fill-in-the-blanks).

Return ONLY valid JSON:
{{
  "title": "Test {t_meta['test_num']}",
  "test_num": {t_meta['test_num']},
  "sections": [
    {{
      "title": "Passage Title",
      "content": "Full passage text...",
      "questions": [
        {{
          "question_num": 1,
          "type": "mcq",
          "text": "The text states...",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correct_answer": "A",
          "explanation": "Brief reason"
        }},
        {{
          "question_num": 2,
          "type": "text",
          "text": "True/False/Not Given statement here...",
          "correct_answer": "TRUE",
          "explanation": "Located in paragraph 2"
        }}
      ]
    }}
  ]
}}

Text for Test {t_meta['test_num']}:
\"\"\"
{t_meta['text'][:30000]}
\"\"\""""

            try:
                response = model.generate_content(test_prompt)
                res_json = response.text.strip()
                if res_json.startswith("```"):
                    res_json = res_json.split("```")[1]
                    if res_json.startswith("json"): res_json = res_json[4:]
                
                test_data = json.loads(res_json.strip())
                book_structure["tests"].append(test_data)
            except Exception as ai_err:
                print(f"AI Error for Test {t_meta['test_num']}: {ai_err}")
                continue

        return jsonify(book_structure)

    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5005))
    app.run(host='0.0.0.0', port=port, debug=True)
