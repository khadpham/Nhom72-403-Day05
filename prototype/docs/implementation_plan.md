# Vietnam Airlines – Omni-channel Proactive LLM Agent
## Implementation Plan (Prototype v0.1)

Dựa trên bản phân tích AI Product Canvas, hệ thống cần phải giải quyết 2 điểm nghẽn chính:
1. Bộ lọc vé thủ công chỉ lọc được 1 trường tại 1 thời điểm
2. Thiếu chăm sóc chủ động, cá nhân hóa với khách hàng thân thiết

---

## User Review Required

> [!IMPORTANT]
> Đây là **bản phân tích + diagram** để confirm hiểu đúng yêu cầu, **CHƯA phải code prototype**. Vui lòng review và approve trước khi tiến hành build.

> [!WARNING]
> Prototype sẽ là **frontend-only demo** (không có backend thật). API calls tới Amadeus, CDP, Zalo sẽ được **mock** bằng dữ liệu giả để demo flow. Nếu cần tích hợp thật, cần thảo luận thêm.

---

## Các Tính năng & Use Case Cơ bản

Từ BMC, xác định được **4 use case cốt lõi**:

| # | Use Case | Actor | Mô tả ngắn |
|---|----------|-------|------------|
| UC-01 | Cá nhân hóa Chủ động (Proactive Greeting) | Khách VIP đã đăng nhập | Agent nhận diện thói quen bay, chủ động gợi ý chuyến bay thân quen + ưu đãi phù hợp |
| UC-02 | Tìm vé Lọc Đa trường (Multi-field Search) | Bất kỳ người dùng | Chat bằng ngôn ngữ tự nhiên và AI tự phân tách, gọi API với nhiều tham số cùng lúc |
| UC-03 | Suy luận Đa bước cho Nhóm phức tạp | Gia đình, người cao tuổi, trẻ em | AI hỏi follow-up, phân loại hành khách, tư vấn hạng ghế, dịch vụ đặc biệt + tính tổng |
| UC-04 | Check-in bằng File PDF / Ảnh CCCD | Bất kỳ người dùng | Upload ảnh/PDF, AI Extract thông tin, điền form check-in tự động |

Ngoài ra còn **2 failure path** quan trọng cần handle:

| # | Failure Path | Mô tả |
|---|------|-------|
| FP-01 | Truy vấn lòng vòng / Ảo giác | User thay đổi ý định liên tục → AI bị rối → Hỏi lại hoặc transfer to agent |
| FP-02 | PDF mờ / Low confidence OCR | AI không đọc được → Hỏi PNR thủ công → Hoàn tất qua mã |

---

## Flow Diagrams (Mermaid)

### UC-01: Proactive Greeting – Cá nhân hóa Chủ động

```mermaid
flowchart TD
    A([Khách VIP đăng nhập]) --> B{CDP nhận diện\nHành vi Bay}
    B -->|Có lịch sử bay quen\nDwell time > 2 phút| C[Agent kích hoạt\nPop-up Chat Chủ động]
    B -->|Không đủ dữ liệu\nhoặc khách mới| D[Hiển thị Chat thụ động\nkhông pop-up]
    C --> E[Agent gửi lời chào cá nhân hóa\n+ Gợi ý chuyến bay quen + Ưu đãi]
    E --> F{Khách phản hồi?}
    F -->|Xác nhận đặt| G[AI gọi Amadeus API\nFilter: tuyến bay + giá + hạng]
    F -->|Không phải/ Bỏ qua| H[Ẩn pop-up, ghi log\nFrequency cap: next 7 ngày]
    G --> I[Trả về Card UI:\nThông tin chuyến bay + Link Thanh toán]
    I --> J[Gửi xác nhận Zalo / SMS]
    J --> K([Khách bấm Thanh toán\nHoàn tất])
```

---

### UC-02: Multi-field Natural Language Search – Lọc Đa trường

```mermaid
flowchart TD
    A([User nhập câu hỏi\nbằng ngôn ngữ tự nhiên]) --> B[LLM Intent Parser\nBóc tách ý định]
    B --> C{Đủ thông tin\nđể gọi API?}
    C -->|Thiếu thông tin| D[AI hỏi follow-up\nClarifying Question]
    D --> A
    C -->|Đủ| E[Tool Use: Amadeus API\nFilter đa trường cùng lúc:\nghiá, giờ, ngày, hạng vé]
    E --> F{API trả về\nkết quả?}
    F -->|Không có vé phù hợp| G[AI thông báo,\ngợi ý nới lỏng bộ lọc]
    G --> D
    F -->|Có kết quả| H[AI tổng hợp + Render\nCard UI danh sách chuyến bay]
    H --> I{User chọn chuyến?}
    I -->|Chọn| J[Bảng Xác nhận Tóm tắt\nUser review trước khi đặt]
    I -->|Không hài lòng| K[AI gợi ý điều chỉnh\nhoặc lọc lại]
    K --> A
    J --> L{User xác nhận?}
    L -->|Xác nhận| M([Tiến hành Thanh toán])
    L -->|Sửa| D
```

---

### UC-03: Multistep Reasoning – Đặt vé Nhóm Phức tạp

```mermaid
flowchart TD
    A([User nhập yêu cầu phức tạp\nNhiều hành khách, điều kiện đặc biệt]) --> B[LLM Phân tích cú pháp\nNhiều ý định lồng nhau]
    B --> C[Phân loại Hành khách:\nAdult / Senior / Child / Infant]
    C --> D[Xác định Nhu cầu Đặc biệt:\nXe lăn, Nôi em bé, Hạng ghế]
    D --> E[Áp dụng Quy tắc Nghiệp vụ:\nauto-apply giảm giá Senior 15%\nBulkhead seat for Infant Bassinet]
    E --> F[Tool Use: Amadeus API\nParams: chặng + giờ + 4 loại hành khách\n+ Giá phân nhóm]
    F --> G{Cần xác nhận\nbổ sung từ User?}
    G -->|Cần| H[AI hỏi Follow-up\n1 câu, 1 điểm cụ thể]
    H --> I{User trả lời?}
    I -->|Trả lời| G
    I -->|Không phản hồi| J[Giả định mặc định hợp lý\nGhi chú rõ trong kết quả]
    G -->|Không cần\nĐủ thông tin| K[AI tổng hợp Tư vấn:\nHạng vé + Vị trí ghế\n+ Dịch vụ đặc biệt + Tổng tiền]
    J --> K
    K --> L[Bảng Xác nhận Chi tiết\nUser review từng mục]
    L --> M{User duyệt?}
    M -->|Chỉnh sửa| H
    M -->|Xác nhận| N([Giữ chỗ + Đặt dịch vụ\nXe lăn + Nôi em bé])
```

---

### UC-04: Multimodal Check-in – Check-in bằng PDF/Ảnh

```mermaid
flowchart TD
    A([User gửi file PDF\nhoặc ảnh CCCD/Passport]) --> B[Vision / OCR Model\nĐọc & Trích xuất thông tin]
    B --> C{Mức độ tự tin\nOCR Confidence?}
    C -->|HIGH ≥ 85%| D[Extract: Họ tên + PNR\nNgày bay + Số hộ chiếu]
    C -->|LOW < 85%| E[AI KHÔNG đoán bừa\nYêu cầu nhập thủ công]
    E --> F[User gõ mã PNR\n6 ký tự]
    F --> G[Lookup PNR qua API\nLấy thông tin đặt vé]
    D --> H{Phát hiện\nthông tin nhạy cảm?}
    H -->|Số thẻ tín dụng\nPCI-DSS risk| I[PII Filter: Tự động Redact\nCảnh báo User không gửi TT tài chính]
    H -->|Chỉ có CCCD/Passport\nBình thường| J[Pre-fill Form Check-in\nHiển thị để User xác nhận]
    G --> J
    J --> K{User xác nhận\nthông tin?}
    K -->|Sai, sửa| L[User chỉnh sửa thủ công]
    L --> K
    K -->|Đúng, xác nhận| M[Hoàn tất Check-in Online]
    M --> N[Gửi Boarding Pass\nqua Chat + Email]
    N --> O([Kết thúc])
```

---

### FP-01: Failure Path – Truy vấn Lòng vòng

```mermaid
flowchart TD
    A([User nhập câu lòng vòng\nThay đổi ý định nhiều lần]) --> B[LLM Intent Parser\nPhát hiện Conflicting Intents]
    B --> C{Số lần mâu thuẫn\ntrong 1 phiên}
    C -->|Lần 1-2| D[AI Hỏi lại Cụ thể:\nConfirm từng tham số một]
    D --> E{User clarify?}
    E -->|Rõ ràng| F[Tiếp tục luồng bình thường\nUC-02 hoặc UC-03]
    E -->|Vẫn mâu thuẫn| C
    C -->|≥ 3 lần| G[AI xin lỗi + Tóm tắt\nnhững gì đã hiểu được]
    G --> H{User xác nhận\ntóm tắt?}
    H -->|Đúng, tiếp tục| F
    H -->|Vẫn sai| I[Escalate: Chuyển\ncho Tổng đài viên người thật]
    I --> J[Mở Widget Live Chat\n+ Ghi log phiên hội thoại\ncho agent người thật]
    J --> K([Tổng đài viên tiếp quản])
```

---

## Proposed Prototype Scope (v0.1)

Dựa trên phân tích, prototype sẽ là một **Web App giao diện chat** demo đủ 4 use case:

### Giao diện bao gồm:
1. **Landing Page** – Hero section với branding Vietnam Airlines
2. **Chat Widget** – Giao diện chat nổi, hỗ trợ bubble messages, typing indicator, streaming text
3. **Card UI** – Component hiển thị kết quả chuyến bay (Flight Card)
4. **Proactive Pop-up** – Modal tự bật sau 2s với greeting cá nhân hóa (có thể toggle)
5. **File Upload** – Khu vực kéo thả file PDF/ảnh cho UC-04
6. **Confirmation Panel** – Bảng xác nhận trước khi "đặt"

### Tech Stack:
- **HTML + CSS + Vanilla JS** (không cần backend, dùng mock data)
- Mock LLM responses: State machine đơn giản nhận diện keyword và route đúng flow
- Mock Amadeus API: Dữ liệu chuyến bay hardcoded JSON

### Files dự kiến:
```
Nhom72-403-Day05/
├── index.html           # Landing page + Chat widget
├── css/
│   ├── main.css         # Design system, tokens
│   ├── chat.css         # Chat component styles
│   └── cards.css        # Flight card styles
├── js/
│   ├── chatbot.js       # State machine + Message routing
│   ├── mock-api.js      # Mock Amadeus + CDP data
│   ├── flows/
│   │   ├── uc01-proactive.js   # UC-01 flow
│   │   ├── uc02-search.js      # UC-02 flow  
│   │   ├── uc03-group.js       # UC-03 flow
│   │   └── uc04-checkin.js     # UC-04 flow
│   └── ui.js            # UI helpers, card renderer
└── assets/
    └── (images, icons)
```

---

## Verification Plan

### Kiểm tra thủ công theo từng Use Case:
- [ ] UC-01: Đăng nhập như User VIP → Pop-up hiện đúng → Chat → Nhận Card chuyến bay → "Đặt"
- [ ] UC-02: Nhập câu dài có nhiều điều kiện → AI parse đúng → Hiện danh sách chuyến → Confirm
- [ ] UC-03: Nhập yêu cầu gia đình 4 người → AI phân loại → Tư vấn đúng hạng/dịch vụ → Tổng tiền
- [ ] UC-04: Upload PDF → Hiện thông tin extract → Confirm → Boarding pass
- [ ] FP-01: Nhập câu lòng vòng → AI hỏi lại → Nếu quá 3 lần → Nút "Gặp nhân viên"

### Open Questions:
> [!IMPORTANT]
> 1. Prototype có cần hỗ trợ **Mobile responsive** không hay chỉ cần chạy trên Desktop?
> 2. Có muốn thêm **Dark Mode** cho giao diện chat không?
> 3. Ngôn ngữ giao diện: **Tiếng Việt hoàn toàn** hay cần cả tiếng Anh?
