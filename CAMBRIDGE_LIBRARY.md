# 📚 Tài liệu Hệ thống Cambridge Library — LexiLearn

Tài liệu này tổng hợp toàn bộ các thay đổi, nâng cấp và hiệu chỉnh hệ thống **Cambridge Library** để đạt chuẩn IELTS chuyên nghiệp.

---

## 1. Giao diện Dashboard (2x2 Grid)
Giao diện quản lý được thiết kế lại theo dạng lưới 2x2 cân đối, mang lại cảm giác hiện đại và cao cấp:
- **Reading & Listening**: Nằm ở hàng trên.
- **Writing & Speaking**: Nằm ở hàng dưới.
- **Tính năng**: 
  - Thanh tìm kiếm theo tiêu đề/số sách.
  - Bộ lọc theo Band Level (6.0 - 8.5).
  - Hiệu ứng hover và gradient cao cấp.

## 2. Wizard Tạo đề 3 Bước (3-Step Wizard)
Quy trình tạo đề được chuẩn hóa để giáo viên kiểm soát tốt nhất cấu trúc bài thi:
1.  **Bước 1: Thông tin ngữ cảnh**: Chọn kỹ năng, phân loại (Passage 1/2/3...), số sách và Band mục tiêu.
2.  **Bước 2: Định nghĩa cấu trúc**: Chọn các dạng câu hỏi IELTS thực tế (Matching Headings, T/F/NG, Map Labelling...). Hệ thống tự động tính toán dải câu hỏi.
3.  **Bước 3: Trình soạn thảo chuyên biệt**: Mỗi kỹ năng có một Editor riêng.

## 3. Các Trình soạn thảo Kỹ năng (Specialized Editors)

### 📖 Reading Editor
- **Bố cục 60/40**: 
  - Bên trái (60%): Passage Viewer (hỗ trợ Import PDF, Zoom, Dark Mode, Highlight).
  - Bên phải (40%): Q&A Builder để nhập câu hỏi và đáp án.

### 🎧 Listening Editor
- **Audio Control**: Trình phát nhạc dạng sóng (Waveform) với tốc độ tùy chỉnh (0.75x - 1.5x).
- **Phân đoạn**: Chia theo Section 1-4 đúng chuẩn đề thi thật.

### ✍️ Writing Editor
- **Task Description**: Soạn thảo đề bài (Rich-text) kèm upload hình ảnh.
- **Sample Answer**: Trình soạn thảo đáp án mẫu với bộ đếm từ (Word Count) thời gian thực.

### 🎤 Speaking Editor
- **Cấu trúc 3 phần**: Điều hướng nhanh giữa Part 1, 2 và 3.
- **Cue Card Editor**: Trình soạn thảo dành riêng cho Part 2 (Topic + Bullet points).
- **Timer Config**: Cấu hình thời gian chuẩn bị và thời gian nói cho từng phần.

## 4. Hệ thống Dữ liệu & Lưu trữ
- **saveBook**: Logic lưu trữ được nâng cấp để lưu các cấu trúc phức tạp (JSON serialized) như cue cards, đáp án mẫu và meta-data thời gian.
- **Database**: Tích hợp chặt chẽ với Supabase, đảm bảo tính nhất quán giữa `books`, `tests`, `sections` và `questions`.

## 5. Công cụ Phát triển (Dev Tools)
- **Dev Bypass**: Đã chỉnh sửa cơ chế Mock JWT (`mock.token.bypass`) để giáo viên có thể vào thẳng Dashboard Cambridge mà không bị chặn bởi CORS/Auth trong quá trình phát triển.

---
*Tài liệu này thay thế cho các file IMPROVEMENTS.md, UPGRADE_BLUEPRINT.md và ielts-exercise-system.md cũ.*
