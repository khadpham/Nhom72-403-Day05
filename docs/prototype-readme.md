# Prototype Readme – Vietnam Airlines NEO

**Level:** Working

NEO là prototype web chat cho Vietnam Airlines, tập trung vào 4 luồng chính: tìm vé đa điều kiện, tư vấn nhóm/phức tạp, check-in online bằng PNR/PDF và chăm sóc chủ động cho hội viên Lotusmiles. Prototype hiện chạy theo mô hình VNA-only, dùng dữ liệu cục bộ và backend FastAPI để demo an toàn các luồng đặt vé, check-in và phản hồi dịch vụ.

**Link prototype:** https://github.com/huytdqhe180383/Nhom72-403-Day05.git

## Thông tin nhanh

| Mục | Nội dung |
|---|---|
| Tên prototype | Vietnam Airlines NEO |
| Level | Working |
| Phạm vi | VNA-only |
| Kiến trúc | Web app chat + FastAPI backend |

## Tools và API đã dùng

| Nhóm | Chi tiết |
|---|---|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Backend | FastAPI, uvicorn |
| Dữ liệu cục bộ | `mock_data/*.csv`, `logs/chat_history.jsonl`, `logs/service_feedback.db` |
| API chính | `/api/chat`, `/api/chat/stream`, `/api/flights/search`, `/api/flights/from-text`, `/api/session/bind-user`, `/api/history/{session_id}`, `/api/checkin/pnr`, `/api/checkin/seatmap`, `/api/checkin/select-seat`, `/api/checkin/upload`, `/api/feedback` |
| UI / State | `localStorage`, shared chat widget, tickets page, check-in page, feedback card, clear-history button |

## Phân công (draft)

> Bạn có thể bổ sung chi tiết sau nếu cần. Phần dưới đang giữ ở mức draft để tiện chỉnh tiếp.

| Vai trò | Người phụ trách | Ghi chú |
|---|---|---|
| Tech Lead / Kỹ sư AI (AI Product) | Đan | Xây dựng hệ thống phân tích ý định và suy luận đa bước để bóc tách yêu cầu phức tạp; phụ trách tích hợp đọc hiểu PDF / hình ảnh cho check-in online |
| Kỹ sư Backend (Backend Engineer) | @Nguyễn Duy Hiếu | Kết nối hạ tầng dữ liệu và xây dựng các hàm công cụ (Tools) như tìm kiếm chuyến bay, tính chi phí; xử lý tích hợp API để gọi và lọc nhiều trường dữ liệu cùng lúc |
| Lập trình viên Frontend (Frontend Developer) | @Quang Huy | Xây dựng giao diện chat trực quan với card chuyến bay và nút gợi ý nhanh; triển khai cơ chế streaming để giảm cảm giác chờ đợi |
| Quản lý Sản phẩm (Product Manager) | @Vũ Đức Kiên | Nghiên cứu sản phẩm, thiết kế kịch bản kiểm thử và giám sát chỉ số chất lượng như độ trễ, CSAT; thiết lập guardrails để tránh bot bịa thông tin hoặc lộ dữ liệu nhạy cảm |