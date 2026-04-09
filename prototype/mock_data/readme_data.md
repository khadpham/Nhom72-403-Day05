# 🛫 Airline Management & Customer Analytics Dataset (Vietnam Airlines Edition)

## 📌 1. Tổng quan dự án (Project Overview)
Hệ thống cung cấp bộ dữ liệu giả lập thực tế tập trung vào hãng hàng không quốc gia **Vietnam Airlines**, được thiết kế đặc thù cho các bài toán **Data Science** và **Machine Learning** tại VinUNI. Bộ dữ liệu hỗ trợ tối đa cho việc xây dựng Chatbot cá nhân hóa và các mô hình dự báo giá vé, hành vi người dùng.

---

## 🏗️ 2. Kiến trúc dữ liệu (Data Architecture)
Dữ liệu được tổ chức theo mô hình **Quan hệ (Relational Model)** giúp tối ưu hóa truy vấn và đảm bảo tính nhất quán giữa các thực thể: Khách hàng - Chuyến bay - Chỗ ngồi - Giao dịch - Hội thoại.

---

## 📄 3. Chi tiết các tệp dữ liệu (Data Dictionary)

### 3.1. `flights.csv` (Danh mục lịch trình gốc)
Lưu trữ danh mục chuyến bay tiêu chuẩn.
| Column | Description |
| :--- | :--- |
| `flight_number` | Mã hiệu chuyến bay (Primary Key). Ví dụ: VN163, VN211. |
| `airline` | Luôn là "Vietnam Airlines". |
| `origin` | Thành phố khởi hành (Hà Nội, TP.HCM...). |
| `destination` | Thành phố điểm đến (Đà Nẵng, Seoul, Tokyo...). |
| `standard_departure` | Giờ cất cánh tiêu chuẩn (HH:mm). |

### 3.2. `customers.csv` (Thông tin hành khách)
Dữ liệu định danh duy nhất cho từng khách hàng trong hệ thống.
| Column | Description |
| :--- | :--- |
| `customer_id` | Mã khách hàng duy nhất (Primary Key). Ví dụ: CUST_001. |
| `full_name` | Họ và tên đầy đủ (IN HOA theo chuẩn Passport). |
| `passport_number` | Số hộ chiếu hoặc CCCD của hành khách. |
| `email` | Địa chỉ email liên hệ nhận vé. |

### 3.3. `flight_seats_premium_logic.csv` (Sơ đồ ghế & Trạng thái)
Tầng dữ liệu chi tiết nhất mô tả trạng thái từng ghế cụ thể trên từng chuyến bay.
| Column | Description |
| :--- | :--- |
| `flight_number` | Mã hiệu chuyến bay (Foreign Key). |
| `airline` | Luôn là "Vietnam Airlines". |
| `origin` / `destination` | Thông tin chặng bay. |
| `date` | Ngày bay thực tế (YYYY-MM-DD). |
| `departure` / `arrival` | Thời gian thực tế cất cánh và hạ cánh dự kiến. |
| `class` | Hạng ghế (**economy**, **premium**, **business**). |
| `seat_no` | Số ghế vật lý (Ví dụ: 1A, 5C, 12F). |
| `attribute` | Vị trí ghế (Window, Aisle, Middle). |
| `seat_price` | Giá ghế (Đã bao gồm phụ phí vị trí và hạng ghế). |
| `status` | Trạng thái ghế tại thời điểm truy vấn (`available` / `occupied`). |

### 3.4. `booking_history.csv` (Lịch sử giao dịch)
Bảng cầu nối lưu trữ mọi giao dịch đặt vé đã hoàn thành hoặc bị hủy.
| Column | Description |
| :--- | :--- |
| `booking_id` | Mã đặt chỗ duy nhất (BK_1001). |
| `customer_id` | Mã khách hàng (Foreign Key). |
| `flight_number` | Mã hiệu chuyến bay (Foreign Key). |
| `flight_date` | Ngày thực hiện chuyến bay. |
| `seat_no` | Số ghế hành khách đã chọn thành công. |
| `class` | Hạng vé thực tế đã mua. |
| `booking_status` | Tình trạng vé (Completed, Cancelled). |

### 3.5. `customer_chat_history_vna.csv` (Lịch sử hội thoại)
Dữ liệu văn bản dùng để huấn luyện Chatbot cá nhân hóa.
| Column | Description |
| :--- | :--- |
| `chat_id` | Mã định danh tin nhắn. |
| `customer_id` | ID khách hàng thực hiện gửi tin nhắn. |
| `message` | Nội dung tin nhắn thực tế từ phía khách hàng. |
| `timestamp` | Thời điểm gửi tin nhắn. |
| `sentiment` | Sắc thái cảm xúc (Positive, Neutral, Negative). |

---

## 🧠 4. Business Logic & Personalization (Quy tắc hệ thống)

1. **Cấu hình máy bay (Vietnam Airlines Style):**
   - **Thân hẹp (A321):** 16 Business, 24 Premium, 168 Economy.
   - **Thân rộng (B787/A350):** 28 Business, 45 Premium, 261 Economy (Chặng quốc tế).
2. **Chiến lược giá (Pricing Logic):**
   - **Premium Class:** Mặc định bằng $1.4 \times$ giá Economy.
   - **Seat Surcharge:** Ghế Window và Aisle có phụ phí cao hơn ghế Middle (đặc biệt với hạng Premium).
3. **Cá nhân hóa (Chatbot Logic):**
   - Chatbot ưu tiên nhận diện thành viên **Lotusmile** dựa trên `customer_id`.
   - Phân tích `sentiment` từ lịch sử chat để điều chỉnh giọng văn (Trang trọng/Thân thiện).

---

## 🛠️ 5. Hướng dẫn kỹ thuật (Technical Notes)

- **Encoding:** Toàn bộ file CSV được xuất ở định dạng **UTF-8 with BOM (`utf-8-sig`)** để đảm bảo hiển thị đúng tiếng Việt trên Microsoft Excel và các trình soạn thảo code.
- **Python Script:** Sử dụng thư viện `pandas` và `random` để duy trì sự nhất quán giữa các file dữ liệu (Foreign Key Mapping).

---
> **Note:** Dataset này phục vụ mục đích nghiên cứu dự án nhóm tại **VinUNI**. Các thông tin cá nhân đều là dữ liệu giả lập (Synthetic Data).