# NEO Vietnam Airlines – Spec Final

**Status:** Working prototype

Tài liệu này chuẩn hóa lại bản phân tích Business Model Canvas Vietnam Airlines và đối chiếu với prototype hiện tại đã được hiện thực trong workspace. Mục tiêu là giữ đúng tinh thần sản phẩm: trợ lý AI đa điểm chạm, ưu tiên độ chính xác, cá nhân hóa cho hội viên và hỗ trợ tự phục vụ các tác vụ vé máy bay / check-in.

## 1. Mục tiêu sản phẩm

NEO được thiết kế để giảm ma sát trong các tác vụ phổ biến của Vietnam Airlines: tìm vé, lọc đa trường, check-in online, tư vấn chuyến bay và hỗ trợ nhóm hành khách phức tạp. So với giao diện web truyền thống, prototype hiện tại chuyển trọng tâm sang hội thoại tự nhiên, cho phép người dùng mô tả nhu cầu bằng tiếng Việt và nhận phản hồi theo card UI hoặc luồng check-in trực quan.

## 2. Đối chiếu giữa Canvas và prototype hiện tại

| Canvas / Ý tưởng ban đầu | Prototype hiện tại |
|---|---|
| Lọc đa trường qua AI | Đã hiện thực bằng backend FastAPI + dữ liệu cục bộ, hỗ trợ lọc theo tuyến, ngày bay, giá, hạng ghế và khung giờ |
| Cá nhân hóa cho hội viên Lotusmiles | Đã hiện thực bằng demo login, bind session user, lời chào cá nhân hóa và history summary |
| Check-in đa phương thức | Đã hiện thực theo hướng thực dụng: tra cứu PNR, upload PDF, seatmap và chọn ghế |
| Chăm sóc chủ động | Đã hiện thực bằng proactive popup / suggestion card / redirect card có kiểm soát |
| Handoff sang người thật | Đã hiện thực bằng escalation widget với nút gọi / chat tư vấn viên |
| Học từ tín hiệu người dùng | Đã hiện thực tối thiểu bằng lưu feedback sau khi hoàn tất tác vụ |

## 3. Phạm vi prototype hiện tại

Prototype hiện tại là một web app demo gồm 3 trang chính:

- `index.html`: landing page + chat widget chính
- `tickets.html`: trang chọn vé theo bộ lọc, vẫn giữ chat chung giữa các trang
- `checkin.html`: trang check-in online với sơ đồ ghế 6 ghế / hàng

### Những điểm đã hiện thực

- Chat widget dùng chung giữa các trang, giữ lịch sử hội thoại bằng `localStorage`
- Tìm vé VNA-only dựa trên dữ liệu cục bộ
- Hỗ trợ câu lệnh tự nhiên để bóc tách nhiều tiêu chí cùng lúc
- Hỗ trợ nhóm hành khách phức tạp: người lớn, người cao tuổi, trẻ em, em bé
- Hỗ trợ tra cứu PNR, seatmap và chọn ghế
- Hỗ trợ upload PDF để trích xuất PNR
- Hiển thị nút **“Đến trang chọn vé”** sau khi bot hoàn thành phần tư vấn vé; người dùng chủ động bấm để mở tab mới
- Có nút xóa lịch sử trò chuyện
- Có khảo sát đánh giá dịch vụ sau khi hoàn tất luồng vé / check-in
- Có cơ chế chuyển sang tư vấn viên khi yêu cầu vượt phạm vi hoặc có ý định liên hệ người thật

## 4. Luồng chức năng chính

### UC-01: Cá nhân hóa chủ động

- User đăng nhập demo
- Hệ thống bind session với user demo
- Agent có thể hiển thị lời chào cá nhân hóa hoặc proactive popup
- Nếu user phản hồi, agent tiếp tục gợi ý chuyến bay phù hợp

### UC-02: Tìm vé lọc đa trường

- User nhập câu tự nhiên như “vé Hà Nội đi Đà Nẵng ngày 15/4, giá dưới 2 triệu, bay buổi sáng”
- Agent bóc tách intent và gọi API tìm vé
- Kết quả trả về là danh sách card chuyến bay Vietnam Airlines
- Sau khi trả lời xong, nếu có đủ điều kiện, hiển thị nút **“Đến trang chọn vé”** để user mở tab mới

### UC-03: Suy luận đa bước cho nhóm phức tạp

- User mô tả nhóm có người già, trẻ em, em bé
- Agent phân loại hành khách và đưa tư vấn sơ bộ
- Hệ thống có thể gợi ý hạng ghế, dịch vụ xe lăn, nôi em bé và ước tính giá
- User xem bảng xác nhận rồi mới tiếp tục

### UC-04: Check-in online

- User nhập PNR hoặc upload PDF
- Hệ thống tra cứu PNR theo dữ liệu cục bộ
- Nếu hợp lệ, hiển thị boarding pass / seatmap
- User chọn ghế và xác nhận check-in
- Sau khi check-in thành công, hệ thống hiện bảng đánh giá dịch vụ

### UC-05: Handoff và guardrails

- Nếu user yêu cầu ngoài phạm vi Vietnam Airlines, bot từ chối ngắn gọn và gợi ý chủ đề phù hợp
- Nếu user nhắc tới tư vấn viên / tổng đài / đổi vé / hoàn tiền / khiếu nại, bot chuyển sang escalation widget
- Frontend có guard bổ sung để tránh bot trả lời lệch phạm vi

### UC-06: Phản hồi sau tác vụ hoàn tất

- Sau khi user mở trang vé hoặc check-in thành công, hệ thống hiển thị survey đánh giá:
  - Tốt
  - Ổn
  - Chưa tốt
  - Tệ
- Với đánh giá thấp, user phải nhập thêm góp ý cải thiện
- Feedback được lưu vào SQLite để phục vụ theo dõi chất lượng

## 5. Kiến trúc prototype

### Frontend

- `index.html`: landing page, quick actions, chat widget
- `tickets.html`: trang chọn vé, dùng lại chat widget
- `checkin.html`: trang check-in và seatmap
- `js/app.js`: điều phối chat, redirect, escalation, persistence và feedback cho flow vé
- `js/tickets.js`: render danh sách vé và chọn hạng ghế
- `js/checkin.js`: load seatmap, chọn ghế và trigger feedback sau check-in
- `js/ui.js`: dựng card, message bubble, escalation widget, redirect prompt, feedback card

### Backend

- `backend/server.py`: FastAPI app, session handling, chat APIs, check-in APIs, feedback API
- `backend/tools.py`: toolset cho flight search, fee calc, PNR lookup, profile summary và flight services
- `backend/system_prompt.txt`: policy cho scope, handoff, concise response và guardrails

### Dữ liệu và lưu trữ

- `mock_data/`: nguồn dữ liệu cục bộ cho flights, customers, booking history và seatmap
- `logs/chat_history.jsonl`: log hội thoại
- `logs/service_feedback.db`: lưu feedback dịch vụ
- `localStorage`: lưu session UI, trạng thái mở widget và session ID backend

## 6. API contract hiện tại

| Method | Endpoint | Mục đích |
|---|---|---|
| POST | `/api/chat` | Trả lời chat dạng non-stream |
| POST | `/api/chat/stream` | Trả lời chat dạng streaming |
| POST | `/api/flights/search` | Tìm chuyến bay theo bộ lọc |
| POST | `/api/flights/from-text` | Bóc tách bộ lọc từ câu tự nhiên |
| POST | `/api/session/bind-user` | Gắn user demo vào session |
| GET | `/api/history/{session_id}` | Lấy lịch sử session |
| DELETE | `/api/history/{session_id}` | Xóa lịch sử session |
| POST | `/api/checkin/pnr` | Tra cứu PNR |
| POST | `/api/checkin/seatmap` | Lấy seatmap check-in |
| POST | `/api/checkin/select-seat` | Xác nhận ghế đã chọn |
| POST | `/api/checkin/upload` | Trích xuất PNR từ file upload |
| POST | `/api/feedback` | Lưu feedback sau khi hoàn tất tác vụ |

## 7. Yêu cầu phi chức năng

- **Precision first:** ưu tiên đúng hơn đầy đủ; nếu không chắc phải hỏi lại hoặc handoff
- **VNA-only:** prototype hiện tại chỉ phục vụ dữ liệu Vietnam Airlines
- **Latency thấp:** phản hồi ngắn gọn, câu dài dùng streaming
- **User control:** không auto mở tab chọn vé; chỉ mở khi user bấm nút
- **Persistence:** chat history và session phải giữ được giữa các trang
- **Safety / Privacy:** không hỏi thông tin nhạy cảm không cần thiết, có guard cho nội dung ngoài phạm vi
- **Responsive:** prototype cần dùng được trên desktop và có thể co giãn ở màn hình nhỏ

## 8. Chỉ số đánh giá

| Metric | Ngưỡng mục tiêu | Ghi chú |
|---|---:|---|
| Tool use precision | ≥ 98% | Bóc tách đúng filter và gọi đúng API |
| Latency text | < 3 giây | Câu dài dùng streaming |
| Latency check-in / PDF | < 5 giây | Ưu tiên phản hồi nhanh và rõ |
| CSAT | ≥ 4.0 / 5.0 | Lấy từ survey sau khi hoàn tất tác vụ |
| Feedback coverage | 100% cho luồng hoàn tất | Sau mở trang vé / check-in thành công đều hiện survey |

## 9. Giả định và giới hạn

- Đây là prototype working demo, chưa phải hệ thống production
- Amadeus, CDP, Zalo/SMS trong BMC được mô phỏng bằng dữ liệu và API cục bộ
- Chưa có thanh toán thật; prototype chỉ hỗ trợ dẫn người dùng đến bước chọn vé / thanh toán chính thức
- OCR đa phương thức hiện tại tập trung vào PNR / PDF cơ bản, chưa thay thế hệ thống Vision production
- Dữ liệu dùng cho search và check-in là dữ liệu mock nội bộ, không phải nguồn live của hãng

## 10. Hướng phát triển tiếp

- Tích hợp dữ liệu chuyến bay live thay cho mock data
- Kết nối CDP / CRM thật để cá nhân hóa sâu hơn
- Kết nối kênh gửi thông báo thật như Zalo / SMS / Email
- Thêm dashboard xem feedback và phân tích chất lượng tư vấn
- Nâng cấp OCR / Vision cho passport / CCCD với mức tin cậy cao hơn
- Mở rộng ngôn ngữ giao diện song ngữ Việt / Anh
