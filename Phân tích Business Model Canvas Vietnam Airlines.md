# **Báo cáo Nghiên cứu Cải tiến Sản phẩm AI tại Vietnam Airlines (Định dạng SPEC)**

**Nhóm thực hiện:** Nhóm Sinh viên Nghiên cứu Sản phẩm

**Track:** Hàng không / Open

**Problem Statement:** Khách hàng gặp khó khăn với giao diện bộ lọc vé hạn chế và thiếu sự chăm sóc chủ động; Vietnam Airlines cần một Trợ lý AI đa phương thức có khả năng suy luận đa bước, cá nhân hóa sâu cho từng hội viên và lọc đa trường để tăng cường trải nghiệm đặt vé, nâng cao doanh thu phụ trợ.

---

## **1\. AI Product Canvas**

### **A. Giá trị (Value)**

* **Người dùng (User):** Khách hàng B2C, bao gồm những người dùng ít tiếp xúc công nghệ cần hỗ trợ thao tác, và nhóm khách hàng thân thiết/VIP (Hội viên Lotusmiles) cần trải nghiệm cá nhân hóa cao cấp.  
* **Nỗi đau (Pain) & Điểm nghẽn Hệ thống:**  
  * Tính năng lọc giá thủ công trên website hiện tại chỉ cho phép lọc 1 trường tại 1 thời điểm, gây mất thời gian khi khách hàng có nhu cầu phức tạp.  
  * Hệ thống thiếu sự chủ động chăm sóc đối với khách hàng có tần suất bay cao. Việc thông báo quảng cáo, gợi ý chuyến bay hiện tại chủ yếu qua email đại trà (mass email), tỷ lệ chuyển đổi thấp.  
* **Giải pháp AI (AI Solution):** Một LLM Agent tích hợp Đa phương thức (Multimodal) với các tính năng:  
  * **Lọc đa trường (Multi-field Filtering) qua API:** AI nhận yêu cầu bằng ngôn ngữ tự nhiên và gọi API Amadeus để lọc cùng lúc nhiều trường dữ liệu (ví dụ: giá vé \< 2 triệu, bay sau 9h sáng, hạng Phổ thông đặc biệt).  
  * **Suy luận Đa bước (Multistep Reasoning):** Có khả năng đặt câu hỏi follow-up để thu hẹp lựa chọn, từ đó gợi ý lịch trình phù hợp với mục đích chuyến đi.  
  * **Cá nhân hóa sâu & Nhắn tin Chủ động (Proactive Notification):** Tích hợp với Nền tảng Dữ liệu Khách hàng (CDP) của FPT. Đối với khách hàng đăng nhập/thẻ VIP, Agent phân tích lịch sử bay để gửi thông báo (qua Email, Zalo, SMS) về các ưu đãi nâng hạng, gợi ý lịch trình quen thuộc, và cảnh báo thay đổi giờ bay theo thời gian thực.  
  * **Xử lý Đa phương thức:** Đọc hiểu file PDF vé điện tử, hình ảnh Passport/CCCD để tự động điền form làm thủ tục Check-in online.

### **B. Sự tin cậy (Trust)**

* **Khi AI đúng:** AI tự động gợi ý đúng chuyến bay khách hàng hay đi, áp dụng đúng bộ lọc đa trường và render ra giao diện thẻ (Card UI) trực quan.  
* **Khi AI sai:** AI suy luận sai ý định trong các câu lệnh lòng vòng hoặc trích xuất sai tên từ ảnh Passport.  
* **Cách người dùng nhận biết & Sửa lỗi:** Mọi thông tin trước khi thanh toán hoặc xuất vé đều có bảng xác nhận tóm tắt. Người dùng có thể chat lại để yêu cầu AI sửa hoặc bấm nút "Gặp nhân viên" để chuyển giao cho tổng đài viên.

### **C. Khả năng Thực thi (Feasibility)**

* **Chi phí:** Ước tính khoảng 0.05 \- 0.10 USD/phiên hội thoại (bao gồm phí token LLM, phí hạ tầng Cloud và API NDC Amadeus).  
* **Độ trễ (Latency):** \< 3 giây để kích hoạt lời chào. Nếu AI cần sinh ra đoạn văn bản dài hoặc lập luận phức tạp, hệ thống sử dụng cơ chế truyền phát (Streaming) để hiển thị chữ theo thời gian thực, tránh cảm giác chờ đợi.  
* **Rủi ro chính:** AI sinh ảo giác (hallucination) tự bịa ra giá vé rẻ hơn thực tế hoặc vi phạm quyền riêng tư khi xử lý dữ liệu hồ sơ Lotusmiles.

### **D. Lựa chọn Thiết kế (Design Choice)**

Sản phẩm được thiết kế theo mô hình **Augmentation (Gia tăng năng lực)**. AI hoạt động như một tư vấn viên VIP 1-1, giúp chuẩn bị giỏ hàng, thiết lập bộ lọc và điền form hộ. Con người vẫn nắm quyền duyệt thông tin và bấm nút "Thanh toán" cuối cùng để loại trừ rủi ro pháp lý về sai lệch giá vé.

### **E. Tín hiệu Học tập (Learning Signal)**

* **Tín hiệu:** Việc người dùng chấp nhận (Click) hay từ chối các gợi ý cá nhân hóa của AI (Implicit signal); hoặc người dùng trực tiếp sửa lại các bộ lọc do AI tạo ra.  
* **Vòng lặp (Flywheel):** Dữ liệu lịch sử tương tác được lưu trên Data Lake. Khi Agent càng gợi ý chuẩn, khách hàng càng tương tác nhiều; dữ liệu này giúp LLM tinh chỉnh (fine-tune) lại để phán đoán nhu cầu tốt hơn cho các chiến dịch Marketing tương lai.

---

## **2\. User Stories — 4 Paths**

### **1\. Happy Path (Khách hàng Đăng nhập & Cá nhân hóa sâu)**

Bác Bình (Hội viên Lotusmiles hạng Vàng) vừa đăng nhập vào hệ thống.

* **Trigger:** Nền tảng CDP nhận diện bác Bình có thói quen bay Hà Nội \- Đà Nẵng vào cuối mỗi tháng để thăm cháu.  
* Agent chủ động bật pop-up chat (không bật voice): *"Chào bác Bình. Sắp tới cuối tháng, bác có muốn tiếp tục đặt chuyến bay vào sáng thứ Bảy đi Đà Nẵng như tháng trước không ạ? Cháu thấy đang có mã ưu đãi nâng lên hạng Phổ thông Đặc biệt cho Thẻ Vàng đấy ạ."*  
* Bác Bình: *"Ừ, đặt cho tôi chuyến sáng thứ Bảy, giá tốt nhất nhé."*  
* **Thực thi:** AI gọi API lấy đúng thông tin cá nhân lưu sẵn, áp dụng lọc giá, và gửi luôn thẻ thông tin chuyến bay vào khung chat kèm link thanh toán. Đồng thời, Agent tự động gửi 1 tin báo xác nhận lộ trình qua Zalo của bác Bình.

### **2\. Happy Path 2 (Lọc đa trường & Suy luận Đa bước)**

Người dùng vào trang chủ, mở khung chat và nhập một câu hỏi rất dài, chứa nhiều điều kiện và ẩn ý. Người dùng: "Tôi muốn tìm vé đi Phú Quốc vào trưa thứ Sáu tuần sau. Nhà tôi đi 4 người: 1 người lớn, 1 bà cụ 68 tuổi bị đau khớp gối đi lại hơi khó, 1 bé 4 tuổi và 1 bé 1 tuổi rưỡi. Tư vấn giúp tôi nên đi chuyến nào cho đỡ mệt, bà cụ thì nên ngồi hạng nào, ghế nào cho tiện, và bé 1 tuổi rưỡi thì bế tay hay có nôi? Tính tổng tiền cho tôi luôn nhé."

* **Multistep Reasoning (Suy luận đa bước):** AI lập tức bóc tách dữ liệu và thiết lập chuỗi logic:

  * Phân loại hành khách: 1 Người lớn (Adult), 1 Người cao tuổi (Senior \> 60 tuổi \- đủ điều kiện giảm 15% giá vé quốc nội \`\`), 1 Trẻ em (Child), 1 Em bé (Infant \< 2 tuổi).  
  * Giải quyết vấn đề sức khỏe: Bà cụ đau khớp gối \-\> Cần đề xuất dịch vụ xe lăn di chuyển tại sân bay . Em bé 1.5 tuổi \-\> Nằm trong tiêu chuẩn được cung cấp nôi trẻ em (Bassinet) miễn phí trên chuyến bay .  
  * Lập chiến lược chọn ghế & hạng vé: Đề xuất hạng Phổ thông Đặc biệt (Premium Economy) vì có không gian để chân rộng rãi (36 inch), độ ngả ghế sâu và có lối ưu tiên lên máy bay, rất phù hợp cho người già yếu \`\`. Vị trí nên là hàng ghế vách ngăn (Bulkhead) để có không gian lắp nôi cho em bé.  
  * **Thực thi (Tool Use):** AI gọi API Amadeus, truyền cùng lúc các tham số (chặng bay, ngày bay, giờ 11:00-13:00, 4 loại hành khách để áp dụng đúng thuật toán tính giá/giảm giá cho người già và trẻ nhỏ).

* **Phản hồi của Agent (Tông giọng trung tính, rõ ràng):** "Tôi đã tìm được chuyến bay VN123 cất cánh lúc 11:30 trưa thứ Sáu tới, rất phù hợp với lịch trình gia đình. Dựa trên yêu cầu, tôi xin tư vấn như sau:  
  * Hạng vé & Chỗ ngồi: Quý khách nên chọn hạng Phổ thông Đặc biệt để bà cụ có chỗ để chân thoải mái hơn và được ưu tiên làm thủ tục nhanh \`\`. Tôi sẽ thiết lập bộ lọc để chọn hàng ghế đầu vách ngăn (Bulkhead) cho gia đình.  
  * Dịch vụ hỗ trợ: Đối với bà cụ đau khớp, tôi có thể đặt trước dịch vụ xe lăn miễn phí tại sân bay . Đối với bé 1.5 tuổi, hãng có hỗ trợ dịch vụ nôi treo trên vách máy bay nên quý khách không cần bế tay toàn chuyến .  
  * Giá vé: Hành khách 68 tuổi được áp dụng chính sách giảm 15% cho người cao tuổi của Vietnam Airlines \`\`. Tổng chi phí cho cả gia đình (đã bao gồm thuế phí) là \[X\] VNĐ.  
  * Quý khách có muốn tôi tiến hành giữ chỗ và đăng ký luôn xe lăn cùng nôi em bé cho gia đình không?"\*

### **3\. Failure Path (Truy vấn Lòng vòng gây Ảo giác)**

Khách hàng liên tục thay đổi ý định trong một câu dài: *"Cho tôi vé đi Nha Trang ngày 15, à không đổi sang ngày 17, đi buổi sáng, hãng Vietjet hay Vietnam Airlines cũng được miễn rẻ, nhớ thêm suất ăn chay."*

* AI bị rối (State management failure), ghi nhận nhầm hãng bay và bỏ sót yêu cầu "suất ăn chay".  
* Hệ thống hiển thị chuyến bay ngày 17 của Vietnam Airlines (vì bot không bán vé Vietjet) nhưng không có suất ăn. Khách hàng bực mình vì AI không làm đúng yêu cầu và thoát trang.

### **4\. Low-confidence / Correction Path (Thủ tục bằng PDF)**

Người dùng gửi file PDF vé điện tử vào chat: *"Check-in online cho tôi chuyến này."*

* File PDF bị mờ hoặc có mật khẩu. Khả năng đọc OCR của Vision model có độ tự tin thấp (Low confidence).  
* AI không tự đoán bừa mà phản hồi: *"Xin lỗi quý khách, tôi không thể đọc được mã đặt chỗ (PNR) từ file này. Quý khách có thể gõ mã đặt chỗ gồm 6 ký tự vào đây để tôi làm thủ tục tiếp được không?"*  
* Người dùng gõ mã PNR, AI hoàn tất thủ tục và gửi lại Thẻ lên máy bay (Boarding pass) trực tiếp qua cửa sổ chat và Email.

---

## **3\. Eval Metrics \+ Threshold**

### **Chiến lược Tối ưu: Ưu tiên Tối đa PRECISION (Độ chính xác)**

Trong ngành hàng không, hậu quả của việc AI đưa thông tin sai (báo sai giá tiền, nhầm ngày bay, sai tên check-in) không chỉ gây thiệt hại tài chính mà còn vi phạm pháp luật và gây khủng hoảng truyền thông. Do đó, chúng tôi thiết kế hệ thống hướng tới **High Precision**. Nếu AI không chắc chắn hiểu đúng ý người dùng (như ở Failure Path), nó bắt buộc phải hỏi lại (follow-up) hoặc chuyển cho tư vấn viên (chấp nhận giảm Recall) thay vì tự ý thực thi một lệnh gọi API sai.

### **Bảng Chỉ số (Metrics Table)**

| Metric (Chỉ số) | Min Threshold (Ngưỡng chấp nhận) | Red Flag (Báo động đỏ) |
| :---- | :---- | :---- |
| **Độ chính xác Gọi API / Lọc Đa trường (Tool Use Precision)** | ≥ 98% AI truyền đúng và đủ các tham số (giá, giờ, ngày) vào Amadeus API. | \< 95% (Hệ thống liên tục tìm sai vé, nguy cơ gây kiện cáo về giá). |
| **Tỷ lệ Chuyển đổi từ Nhắn tin Chủ động (Proactive Conversion Rate)** | ≥ 5% người dùng click vào các gợi ý/voucher do Agent gửi qua Chat/Zalo/Mail. | \< 1% (Hệ thống nhận diện hành vi kém, gửi thông báo mang tính chất spam). |
| **Độ trễ trung bình (Latency)** | Text response \< 3s; Các câu trả lời dài bắt buộc dùng **Streaming**; Xử lý PDF \< 5s. | API delay \> 8s mà không có Streaming (Khách hàng mất kiên nhẫn). |
| **Chỉ số Hài lòng (CSAT của Bot)** | ≥ 4.0/5.0 sao qua form đánh giá sau chat. | \< 3.0/5.0 (Khách hàng thà dùng bộ lọc cũ còn hơn dùng Bot). |

---

## **4\. Top 3 Failure Modes (Các Hình thức Thất bại Chính)**

1. **Ảo giác Suy luận Đa bước (Reasoning Loop Hallucination)**  
   * **Trigger:** Khách hàng đưa ra một bài toán quá phức tạp ngoài phạm vi (Out-of-domain), ví dụ: *"Lên lịch trình du lịch 5 ngày Đà Nẵng, bao gồm vé máy bay, khách sạn và chỗ ăn ngon."*  
   * **Consequence:** Agent cố gắng trả lời, rơi vào vòng lặp suy luận vô tận hoặc "bịa" ra các chuyến bay không tồn tại để khớp với lịch trình khách sạn ảo.  
   * **Mitigation:** Cài đặt Guardrails (Hàng rào bảo vệ) bằng System Prompt. Nếu Intent (Ý định) vượt quá việc tư vấn/bán vé của hãng, AI sẽ xin lỗi, chỉ cung cấp thông tin vé máy bay và từ chối tư vấn khách sạn/lịch trình ngoài lề.  
2. **Spam Kích hoạt Chủ động (False Proactive Triggering)**  
   * **Trigger:** Nền tảng CDP thiết lập Trigger quá nhạy (ví dụ: cứ khách VIP vào web là tự động gửi Zalo quảng cáo vé hoặc bật pop-up).  
   * **Consequence:** Khách hàng cảm thấy bị theo dõi (creepy) và bị làm phiền, dẫn đến việc unsubscribe (hủy đăng ký) nhận email/tin nhắn của Vietnam Airlines.  
   * **Mitigation:** Áp dụng Frequency Capping (Giới hạn tần suất): Mỗi người dùng chỉ nhận tối đa 1 tin nhắn chủ động trong 1 tuần. Chỉ bật pop-up trên web khi Dwell time \> 2 phút kết hợp với hành vi cuộn trang ngập ngừng.  
3. **Bảo mật Thông tin khi Check-in bằng Ảnh (PII Data Breach)**  
   * **Trigger:** Khách hàng muốn nhờ AI thanh toán hộ nên gửi thẳng ảnh thẻ tín dụng (Credit Card) vào chat thay vì ảnh CCCD.  
   * **Consequence:** AI trích xuất và lưu nhầm dữ liệu thẻ ngân hàng vào hệ thống log, vi phạm nghiêm trọng chuẩn bảo mật PCI-DSS, có thể gợi lại sự cố rò rỉ dữ liệu CRM năm 2025\.  
   * **Mitigation:** Tích hợp bộ lọc PII (Personally Identifiable Information) ngay tại client-side. Nếu Vision nhận diện được chuỗi 16 số thẻ tín dụng, tự động che mờ (redact) ảnh, không lưu trữ và cảnh báo khách hàng không gửi thông tin tài chính qua chat.

---

## **5\. ROI in 3 Scenarios (Bài toán Tỷ suất Hoàn vốn)**

**Giải thích Logic tính toán ROI:** Website Vietnam Airlines hiện có quy mô tối thiểu 60 triệu lượt truy cập/năm (tương đương 5 triệu lượt/tháng). Dịch vụ bổ trợ (Ancillary services \- hành lý, nâng hạng, chọn chỗ) là "mỏ vàng" mang về gần 1.000 tỷ VNĐ mỗi quý (dữ liệu Q3/2025). Logic tính ROI của AI Product này dựa trên sự cân bằng (Triangle) giữa: **Độ chính xác (Precision) \- Tỷ lệ người dùng chấp nhận (Adoption) \- Chi phí vận hành (Cost)**.

### **1\. Kịch bản Thận trọng (Conservative)**

* **Giả định (Assumptions):** Chất lượng AI chỉ ở mức trung bình, khả năng lập luận đa bước hay bị ngắt quãng. User adoption thấp (chỉ \~2% lượng khách, tức khoảng 100.000 user/tháng dùng bot thay cho bộ lọc web).  
* **Logic tác động:** Tính năng cá nhân hóa hoạt động không trơn tru, khách VIP không hứng thú với tin nhắn chủ động. Tỷ lệ chuyển đổi mua vé/upsell không tăng đáng kể.  
* **ROI (Tính cụ thể ước lượng):**  
  * *Chi phí:* \~$15.000/tháng (Phí hạ tầng Cloud, Token LLM, phí duy trì API).  
  * *Lợi ích:* Giảm một lượng nhỏ tải cho tổng đài 1900 1100 (tiết kiệm được khoảng $10.000) và cứu được lượng nhỏ giỏ hàng ($5.000).  
  * *Kết quả:* **ROI \~ 0% (Hòa vốn)**. Chi phí cao so với lượng khách dùng ít, không tạo ra tăng trưởng doanh thu ròng.

### **2\. Kịch bản Thực tế (Realistic)**

* **Giả định (Assumptions):** Mô hình AI hoạt động ổn định, độ chính xác (Precision) đảm bảo \>95%. User adoption đạt khoảng 15% (750.000 lượt dùng/tháng).  
* **Logic tác động:** Khả năng lọc đa trường và gửi thông báo chủ động cá nhân hóa (qua Email/Zalo) tiếp cận đúng tệp khách hàng Lotusmiles. Nhờ AI chủ động mời chào và đặt câu hỏi follow-up, tỷ lệ Upsell (bán thêm hành lý, nâng hạng Premium Economy) tăng 3% \- 5% so với việc khách hàng tự mua.  
* **ROI (Tính cụ thể ước lượng):**  
  * *Chi phí:* Tăng lên mức \~$30.000/tháng do gọi API và Token LLM nhiều hơn.  
  * *Lợi ích:* Tăng 3% doanh thu mảng dịch vụ bổ trợ (khoảng 30 tỷ VNĐ/quý \~ $400.000/tháng). Đồng thời giảm 15% khối lượng cuộc gọi CSKH, tiết kiệm \~$25.000/tháng chi phí nhân sự tổng đài.  
  * *Kết quả:* **ROI \> 1,300%**. Lợi ích vượt xa chi phí API bỏ ra nhờ việc thúc đẩy hành vi tiêu dùng của khách hàng có sẵn.

### **3\. Kịch bản Lạc quan (Optimistic)**

* **Giả định (Assumptions):** AI có độ chính xác xuất sắc, Data Flywheel (vòng lặp học tập từ lịch sử CDP) phát huy tác dụng giúp AI đoán trúng 99% nhu cầu khách VIP. User adoption lan rộng, đạt 35% lượt truy cập.  
* **Logic tác động:** Trợ lý ảo trở thành tính năng "signature" (đặc trưng) mang chuẩn 5 sao của hãng. Lợi thế quy mô (Economies of scale) kết hợp với kỹ thuật Semantic Caching giúp giảm giá thành Token/query xuống 50%.  
* **ROI (Tính cụ thể ước lượng):**  
  * *Chi phí:* \~$40.000/tháng (đã giảm nhờ tối ưu caching).  
  * *Lợi ích:* Doanh thu chuyển đổi trực tiếp và doanh thu phụ trợ tăng vọt. Năng lực Check-in bằng ảnh PDF giúp tự động hóa 40% quy trình mặt đất. Tổng lợi ích ước tính mang về hàng triệu USD mỗi tháng.  
  * *Kết quả:* **ROI \> 5,000%**. Sản phẩm biến Vietnam Airlines thành người tiên phong về trải nghiệm AI trong khu vực.

---

## **6\. Mini AI Spec (Tóm tắt 1 Trang)**

**1\. Tên tính năng:** Trợ lý Thông minh Đa điểm chạm (Omni-channel Proactive LLM Agent).

**2\. Mục đích:** Giải quyết điểm nghẽn của giao diện web truyền thống (bộ lọc thủ công hạn chế) và sự bị động của chatbot cũ. Cung cấp trải nghiệm đặt vé, lọc dữ liệu đa chiều và làm thủ tục trực tuyến bằng ngôn ngữ tự nhiên. Đặc biệt, biến Agent thành một kênh tiếp thị cá nhân hóa cho nhóm khách hàng thân thiết.

**3\. Đối tượng mục tiêu:** Từ người dùng kém am hiểu công nghệ cần hỗ trợ thao tác, cho đến khách hàng VIP/Lotusmiles cần sự nhanh chóng, cá nhân hóa.

**4\. AI đóng vai trò gì?**

* **(1) Phân tích & Lọc đa trường:** Gọi công cụ (Tool Use \- Amadeus API) để tổng hợp nhiều tiêu chí (giá, giờ, hạng ghế) cùng lúc.  
* **(2) Suy luận Đa bước (Reasoning & Follow-up):** Đặt câu hỏi khai thác nhu cầu thực sự của chuyến đi để đưa ra gợi ý phù hợp nhất.  
* **(3) Cá nhân hóa chủ động:** Khai thác dữ liệu CDP, gửi thông báo cá nhân hóa (khuyến mãi, nhắc chuyến bay) đa kênh (Zalo, SMS, Web).  
* **(4) Xử lý Đa phương thức:** Đọc ảnh Passport/CCCD, file PDF vé để tự động check-in online.  
* **(5) Streaming:** Sử dụng truyền phát văn bản để triệt tiêu cảm giác về độ trễ (latency) khi AI cần thời gian dài để suy luận và gọi API.  
  **5\. Tiêu chuẩn Chất lượng:** Tập trung tuyệt đối vào **Precision (Độ chính xác)**. Mọi phán đoán về giá, ngày giờ, thông tin cá nhân phải chuẩn 100%. Nếu không chắc chắn, AI phải hỏi lại hoặc nhường quyền cho con người.  
  **6\. Rủi ro Cốt lõi:** AI suy luận sai vòng lặp, gửi tin nhắn rác làm phiền khách hàng (False triggers), hoặc vi phạm bảo mật khi thu thập nhầm hình ảnh chứa số thẻ tín dụng.  
  **7\. Bánh đà Dữ liệu (Data Flywheel):** Dữ liệu từ các tương tác, lựa chọn chấp nhận/từ chối lịch trình gợi ý của khách hàng (Implicit signals) được lưu trữ vào hệ thống FPT CDP. LLM liên tục học từ kho dữ liệu này để đưa ra các dự đoán hành vi và đề xuất chuyến bay/dịch vụ phụ trợ ngày càng sát với sở thích cá nhân của từng tập khách hàng (ví dụ: luôn gợi ý mua thêm hành lý cho tệp khách gia đình).  
* 

