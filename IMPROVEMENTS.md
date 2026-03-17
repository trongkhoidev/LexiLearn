# 🚀 LexiLearn: Toàn diện Cải tiến & Theo dõi Tiến độ (Improvements Tracker)

Tài liệu này dùng để theo dõi tất cả các đề xuất cải tiến từ Logic nghiệp vụ đến UI/UX, được lấy cảm hứng từ Study4, OpenQuiz và Lingoland.

---

## 📌 0. Trạng thái hiện tại (Current State)

- [x] **Supabase schema (IELTS platform)**: đã tạo đầy đủ bảng cho Teacher/Student, Cambridge library, assignments/submissions, desks, progress, notifications.
- [x] **Frontend data layer**: `src/utils/supabase.js` đã có helpers cho các bảng mới (classrooms, members, assignments, submissions, desks, progress...).
- [x] **Teacher (basic)**:
  - Trang `/classes` + `/class/:id`.
  - Tạo lớp, xem học viên, add học viên bằng UUID.
  - Tạo assignment cơ bản.
  - Giao bài từ Cambridge (nhập `tests.id` → tạo `assignments` + `assignment_targets` cho cả lớp).
- [~] **RLS/Auth**:
  - RLS policy đã được thiết kế (SQL) nhưng **frontend chưa dùng Supabase Auth JWT**, hiện vẫn dùng REST + anon key.
  - Cần tích hợp Supabase Auth (supabase-js) để `auth.uid()` hoạt động đúng.

---

## 🎨 1. Cải tiến UI/UX (Giao diện & Trải nghiệm)

### Hệ thống thiết kế (Design System)
- [~] **Nhất quán Design Tokens**: phần lớn đã có `variables.css`, nhưng cần rà soát toàn bộ UI (đặc biệt các trang mới) để không hardcode màu/spacing.
- [ ] **Dark Mode**: Hỗ trợ giao diện tối (Dark Mode) cho người học ban đêm.
- [ ] **Skeleton Loading**: Áp dụng Skeleton cho tất cả các trang thay vì spinner thô sơ.
- [ ] **Empty States**: Thiết kế minh họa (illustrations) cho các trạng thái trống (không có deck, không có bài tập).

### Trải nghiệm người dùng (UX)
- [ ] **Micro-animations**: Thêm các hiệu ứng chuyển động nhỏ khi hover, click card.
- [ ] **Page Transitions**: Hiệu ứng chuyển trang mượt mà.
- [ ] **Mobile Optimization**: Tối ưu hóa thanh menu dưới (bottom navigation) cho điện thoại.
- [ ] **Onboarding**: Hướng dẫn cho Teacher/Student khi lần đầu đăng nhập (tạo lớp/nhập học viên; tạo desk/làm bài).

---

## 🧠 2. Cải tiến Logic Nghiệp vụ (Business Logic)

### Teacher Platform (Core)
- [x] **Classroom Management (basic)**: tạo lớp, xem lớp, trang chi tiết lớp.
- [ ] **Student Management UX**: tìm học viên theo email, mời/join bằng link, import CSV tạo học viên hàng loạt.
- [ ] **Assignment Lifecycle**:
  - [ ] Assignment detail: danh sách học viên (chưa làm/đang làm/đã nộp/đã chấm).
  - [ ] Grading UI: chấm Writing/Speaking + feedback.
  - [ ] Stats lớp: completion rate, điểm trung bình, weak students.
- [ ] **Materials / Folder Tree UI**:
  - [ ] Teacher tạo cây folder (Vocabulary/Grammar/Skills/Band).
  - [ ] Upload file (PDF/Audio/Video/Image) + tag band/skill/topic.
  - [ ] Share scope theo classroom.

### IELTS Practice (Nâng cao)
- [x] **Test Timer (Reading)**: đã có timer trong `TestPlayer` (đếm ngược).
- [ ] **Test History (new schema)**: lưu lịch sử làm bài vào `submissions` + `submission_answers` (hiện `TestPlayer` còn lưu vào `user_progress` cũ).
- [ ] **Review Mode**: Chế độ xem lại bài thi đã làm kèm giải thích lý do sai.
- [ ] **Listening Module**: Hỗ trợ bài nghe (audio player với speed control, dictation mode).
- [ ] **Writing Module**: Tính năng chấm bài Writing bằng AI (Gemini) dựa trên 4 tiêu chí IELTS.

### Vocabulary (Từ vựng)
- [ ] **Deck Ownership**: Phân quyền Deck (Công khai của hệ thống vs Cá nhân của học sinh).
- [ ] **Import/Export Pro**: Hỗ trợ import từ Quizlet, CSV, Excel linh hoạt hơn.
- [ ] **Smart SRS**: Tối ưu hóa thuật toán Spaced Repetition (SRS) dựa trên độ khó thực tế của từng người.

---

## 🎮 3. Tính năng Gamification (Hứng thú học tập)

- [ ] **Achievements/Badges**: Hệ thống huy hiệu (Ví dụ: "Học sĩ 7 ngày", "Bậc thầy từ vựng").
- [ ] **Leaderboard**: Bảng xếp hạng trong lớp học hoặc toàn hệ thống.
- [ ] **Daily Challenges**: Nhiệm vụ hàng ngày để nhận XP thêm.
- [ ] **Level System**: Nâng cấp level người dùng dựa trên XP tích lũy.

---

## 🛠️ 4. Kỹ thuật & Hạ tầng (Technical)

- [ ] **Supabase Auth (JWT) integration**:
  - [ ] Thay REST anon-key calls bằng `@supabase/supabase-js` để RLS chạy đúng (`auth.uid()`).
  - [ ] Đồng bộ `auth.users` ↔ `public.profiles` (trigger hoặc post-signup function).
  - [ ] UI login/register + role selection (teacher/student) + guard routes.
- [ ] **RLS Verification**:
  - [ ] Checklist test quyền Teacher/Student trên các bảng chính (classroom, assignment, submission, desk).
  - [ ] Đảm bảo không dùng service role ở client.
- [ ] **PWA (Progressive Web App)**: Cho phép cài đặt ứng dụng vào điện thoại và học offline.
- [ ] **i18n (Đa ngôn ngữ)**: Hỗ trợ chuyển đổi giao diện Tiếng Việt / Tiếng Anh toàn diện.
- [ ] **Caching**: Tích hợp LocalStorage và Service Worker để tăng tốc độ load trang.
- [ ] **Error Boundaries**: Xử lý lỗi tập trung, tránh crash trang khi API lỗi.

---

## ✅ Trạng thái Milestone

| Milestone | Trạng thái | Ghi chú |
|-----------|------------|---------|
| **Phase 1: Data Foundation** | [x] Hoàn thành | Supabase schema + frontend data helpers. |
| **Phase 2: Teacher MVP** | [~] Đang làm | Classrooms + basic assignments + assign Cambridge; thiếu submissions/grading/materials UI. |
| **Phase 3: Auth + RLS** | [ ] Chờ | Tích hợp supabase-js auth + verify RLS end-to-end. |
| **Phase 4: Student MVP** | [ ] Chờ | Student assignments + submissions + Personal Desk + progress snapshots UI. |
| **Phase 5: Content & AI** | [ ] Chờ | Listening/Writing/Speaking AI + analytics + gamification. |
| **Phase 6: Polish & PWA** | [ ] Chờ | Dark mode, skeleton, onboarding, offline mode. |
