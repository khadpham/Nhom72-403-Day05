// ===================================================
// UI RENDERER - Card & Message Components
// ===================================================

const UI = {
  chatMessages: null,
  typingIndicator: null,
  maxStreamChars: 1800,

  init(messagesEl, typingEl) {
    this.chatMessages = messagesEl;
    this.typingIndicator = typingEl;
  },

  // ===== Streaming text simulation =====
  async streamText(text, el, delay = 18) {
    el.textContent = "";
    for (let i = 0; i < text.length; i++) {
      el.textContent += text[i];
      await new Promise(r => setTimeout(r, delay));
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
  },

  // ===== Show typing indicator =====
  showTyping() {
    this.typingIndicator.style.display = "flex";
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  },

  hideTyping() {
    this.typingIndicator.style.display = "none";
  },

  // ===== Internal: create bot message shell =====
  createBotMessageShell(extraClass = "") {
    const wrapper = document.createElement("div");
    wrapper.className = `message bot-message${extraClass ? ` ${extraClass}` : ""}`;

    const avatar = document.createElement("div");
    avatar.className = "bot-avatar";
    avatar.innerHTML = `<img src="assets/neo-avatar.svg" alt="NEO" onerror="this.style.display='none';this.parentElement.textContent='🤖'">`;

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    const textEl = document.createElement("p");
    bubble.appendChild(textEl);
    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
    this.chatMessages.appendChild(wrapper);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

    return { wrapper, textEl };
  },

  // ===== Streaming render helpers =====
  startBotStreamMessage(initialText = "") {
    this.hideTyping();
    this.removeAllThinkingBubbles();
    const shell = this.createBotMessageShell();
    shell.textEl.textContent = initialText;
    return { ...shell, truncated: false };
  },

  appendBotStreamChunk(streamRef, chunk) {
    if (!streamRef || !streamRef.textEl || streamRef.truncated) return;
    const current = streamRef.textEl.textContent || "";
    const next = current + (chunk || "");

    if (next.length > this.maxStreamChars) {
      streamRef.textEl.textContent = next.slice(0, this.maxStreamChars).trimEnd() + "\n\n…(Đã rút gọn để hiển thị)";
      streamRef.truncated = true;
    } else {
      streamRef.textEl.textContent = next;
    }

    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  },

  // ===== Add message =====
  async addBotMessage(text, { stream = true, delay = 500 } = {}) {
    await new Promise(r => setTimeout(r, delay));
    this.hideTyping();
    this.removeAllThinkingBubbles();

    const { wrapper, textEl } = this.createBotMessageShell();

    if (stream) {
      await this.streamText(text, textEl, 20);
    } else {
      textEl.textContent = text;
    }

    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    return wrapper;
  },

  showThinkingBubble(text = "...") {
    this.hideTyping();
    this.removeAllThinkingBubbles();
    const shell = this.createBotMessageShell("thinking-message");
    shell.textEl.textContent = text;
    shell.textEl.classList.add("thinking-bubble");
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    return shell;
  },

  removeThinkingBubble(ref) {
    if (ref?.wrapper && ref.wrapper.parentNode) {
      ref.wrapper.remove();
    }
  },

  removeAllThinkingBubbles() {
    if (!this.chatMessages) return;
    this.chatMessages.querySelectorAll(".thinking-message").forEach(el => el.remove());
  },

  addUserMessage(text) {
    const wrapper = document.createElement("div");
    wrapper.className = "message user-message";
    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = text;
    wrapper.appendChild(bubble);
    this.chatMessages.appendChild(wrapper);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  },

  // ===== Add DOM element (card, etc.) =====
  addElement(el, delay = 800) {
    return new Promise(resolve => {
      setTimeout(() => {
        this.hideTyping();
        this.chatMessages.appendChild(el);
        el.style.opacity = "0";
        el.style.transform = "translateY(10px)";
        el.style.transition = "all 0.3s ease";
        setTimeout(() => {
          el.style.opacity = "1";
          el.style.transform = "none";
        }, 50);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        resolve();
      }, delay);
    });
  },

  // ===== Quick Reply Chips =====
  addQuickReplies(options, onSelect) {
    const container = document.createElement("div");
    container.className = "quick-replies";
    options.forEach(opt => {
      const chip = document.createElement("button");
      chip.className = "quick-reply-chip";
      chip.textContent = opt;
      chip.onclick = () => {
        container.remove();
        onSelect(opt);
      };
      container.appendChild(chip);
    });
    this.chatMessages.appendChild(container);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    return container;
  },

  // ===== Flight Card =====
  createFlightCard(flight, onSelect) {
    const flightClass = (flight.cls || flight.class || "economy").toLowerCase();
    const classTextMap = {
      economy: "Phổ thông",
      premium: "Phổ thông đặc biệt",
      business: "Thương gia"
    };

    const card = document.createElement("div");
    card.className = `flight-card ${flightClass === "business" ? "business-card" : ""} ${flightClass === "premium" ? "premium-card" : ""}`;

    const airlineLogos = {
      "Vietnam Airlines": "🇻🇳",
      "VietJet Air": "🔴",
      "Bamboo Airways": "🟢",
      "Korean Air": "🇰🇷",
      "Singapore Airlines": "🇸🇬",
      "Qantas": "🦘",
      "Japan Airlines": "🇯🇵",
      "Thai Airways": "🇹🇭",
      "AirAsia": "✈️",
      "Cathay Pacific": "🟣"
    };

    const logo = airlineLogos[flight.airline] || "✈️";
    const isVNA = flight.airline === "Vietnam Airlines";
    const badgeHtml = isVNA ? `<span class="vna-badge">Vietnam Airlines</span>` : "";

    card.innerHTML = `
      <div class="flight-card-header">
        <div class="airline-info">
          <span class="airline-logo">${logo}</span>
          <div>
            <span class="airline-name">${flight.airline}</span>
            ${badgeHtml}
          </div>
        </div>
        <div class="flight-class-badge ${flightClass}">${classTextMap[flightClass] || flightClass}</div>
      </div>
      <div class="flight-times">
        <div class="time-block">
          <span class="time">${flight.dep}</span>
          <span class="airport">${flight.origin || ""}</span>
        </div>
        <div class="flight-duration">
          <span class="duration-line"></span>
          <span class="duration-text">${flight.duration || "N/A"}</span>
          <span class="duration-line"></span>
        </div>
        <div class="time-block">
          <span class="time">${flight.arr}</span>
          <span class="airport">${flight.destination || ""}</span>
        </div>
      </div>
      <div class="flight-footer">
        <div class="flight-meta">
          <span class="flight-number">✈ ${flight.fn}</span>
          <span class="seat-count">💺 ${flight.seats} chỗ</span>
          <span class="flight-date">${formatDate(flight.date)}</span>
        </div>
        <div class="flight-price-select">
          <span class="flight-price">${formatPrice(flight.price)}</span>
          <button class="select-flight-btn" data-fn="${flight.fn}">Chọn ›</button>
        </div>
      </div>
    `;

    const btn = card.querySelector(".select-flight-btn");
    btn.onclick = () => {
      document.querySelectorAll(".flight-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      onSelect(flight);
    };

    return card;
  },

  // ===== Flight Results List =====
  createFlightResultsContainer(flights, onSelect, title = "Các chuyến bay phù hợp:") {
    const wrapper = document.createElement("div");
    wrapper.className = "flight-results-wrapper bot-message";

    const titleEl = document.createElement("div");
    titleEl.className = "results-header";
    titleEl.innerHTML = `<span class="bot-avatar-inline">🤖</span><span>${title}</span>`;
    wrapper.appendChild(titleEl);

    const list = document.createElement("div");
    list.className = "flight-cards-list";
    flights.slice(0, 5).forEach(f => {
      list.appendChild(this.createFlightCard(f, onSelect));
    });
    wrapper.appendChild(list);

    if (flights.length > 5) {
      const more = document.createElement("div");
      more.className = "show-more";
      more.textContent = `Xem thêm ${flights.length - 5} chuyến bay khác...`;
      more.onclick = () => {
        flights.slice(5).forEach(f => list.appendChild(this.createFlightCard(f, onSelect)));
        more.remove();
      };
      wrapper.appendChild(more);
    }

    return wrapper;
  },

  // ===== Confirmation Panel =====
  createConfirmationPanel(flight, extraInfo, onConfirm, onEdit) {
    const panel = document.createElement("div");
    panel.className = "confirmation-panel";

    const totalPax = (extraInfo.adults || 1) + (extraInfo.children || 0) + (extraInfo.infants || 0);
    let totalPrice = flight.price * (extraInfo.adults || 1);
    if (extraInfo.hasSenior) totalPrice += flight.price * 0.85; // 15% senior discount
    if (extraInfo.children) totalPrice += flight.price * 0.75 * (extraInfo.children);
    if (extraInfo.infants) totalPrice += flight.price * 0.1; // infants flat fee

    let extrasHtml = "";
    if (extraInfo.needsWheelchair) extrasHtml += `<li>♿ Dịch vụ xe lăn tại sân bay <span class="free-badge">Miễn phí</span></li>`;
    if (extraInfo.needsBassinet) extrasHtml += `<li>🛏 Nôi trẻ em (Bassinet) vách ngăn <span class="free-badge">Miễn phí</span></li>`;
    if (extraInfo.hasSenior) extrasHtml += `<li>👴 Giảm giá 15% người cao tuổi đã áp dụng</li>`;

    panel.innerHTML = `
      <div class="panel-header">
        <span class="panel-icon">📋</span>
        <h3>Xác nhận thông tin đặt chỗ</h3>
      </div>
      <div class="panel-body">
        <div class="confirm-row">
          <span class="confirm-label">Chuyến bay</span>
          <span class="confirm-value flight-num">${flight.fn} · ${flight.airline}</span>
        </div>
        <div class="confirm-row">
          <span class="confirm-label">Hành trình</span>
          <span class="confirm-value">${flight.origin} → ${flight.destination}</span>
        </div>
        <div class="confirm-row">
          <span class="confirm-label">Ngày khởi hành</span>
          <span class="confirm-value">${formatDate(flight.date)}, ${flight.dep}</span>
        </div>
        <div class="confirm-row">
          <span class="confirm-label">Hạng ghế</span>
          <span class="confirm-value">${
            (flight.cls || flight.class) === "business"
              ? "Thương gia (Business)"
              : (flight.cls || flight.class) === "premium"
                ? "Phổ thông đặc biệt (Premium)"
                : "Phổ thông (Economy)"
          }</span>
        </div>
        <div class="confirm-row">
          <span class="confirm-label">Hành khách</span>
          <span class="confirm-value">${totalPax} người ${extraInfo.adults > 1 ? `(${extraInfo.adults} người lớn${extraInfo.children ? ", " + extraInfo.children + " trẻ em" : ""}${extraInfo.infants ? ", " + extraInfo.infants + " em bé" : ""})` : ""}</span>
        </div>
        ${extrasHtml ? `<div class="confirm-extras"><ul>${extrasHtml}</ul></div>` : ""}
        <div class="confirm-total">
          <span>Tổng tiền (ước tính)</span>
          <span class="total-price">${formatPrice(Math.round(totalPrice))}</span>
        </div>
        <div class="ai-disclaimer">
          <span>⚠️</span>
          <p>AI chỉ hỗ trợ tra cứu và gợi ý. Việc thanh toán sẽ được thực hiện trên trang thanh toán chính thức của Vietnam Airlines.</p>
        </div>
      </div>
      <div class="panel-actions">
        <button class="edit-btn" id="btn-edit">✏️ Điều chỉnh</button>
        <button class="confirm-btn" id="btn-confirm">🚀 Đến trang thanh toán</button>
      </div>
    `;

    panel.querySelector("#btn-confirm").onclick = () => onConfirm(flight, totalPrice);
    panel.querySelector("#btn-edit").onclick = () => onEdit();

    return panel;
  },

  // ===== Redirect Banner (Payment) =====
  createPaymentRedirectBanner(flight, totalPrice) {
    const banner = document.createElement("div");
    banner.className = "payment-redirect-banner";
    const url = MockAPI.getPaymentRedirectUrl(flight, 1);

    banner.innerHTML = `
      <div class="redirect-icon">🔗</div>
      <div class="redirect-content">
        <h4>Chuyển đến trang thanh toán</h4>
        <p>Đặt chỗ ${flight.fn} · ${flight.origin} → ${flight.destination} · ${formatPrice(totalPrice)}</p>
        <small>Bạn sẽ được chuyển đến trang thanh toán bảo mật của Vietnam Airlines để hoàn tất đặt vé.</small>
      </div>
      <a class="redirect-btn" href="${url}" target="_blank" onclick="showPaymentSimulation(event, '${flight.fn}', '${formatPrice(totalPrice)}')">Thanh toán ngay →</a>
    `;

    return banner;
  },

  // ===== Redirect Prompt Card =====
  createRedirectPromptCard(total, filters, onAccept, onDecline) {
    const card = document.createElement("div");
    card.className = "redirect-prompt-card bot-message";

    const classMap = {
      economy: "Phổ thông",
      premium: "Phổ thông đặc biệt",
      business: "Thương gia"
    };

    const route = [filters?.origin, filters?.destination].filter(Boolean).join(" → ") || "-";
    const date = filters?.date || "Linh hoạt";
    const cls = filters?.flight_class ? (classMap[filters.flight_class] || filters.flight_class) : "Tất cả hạng";
    const price = typeof filters?.max_price === "number" ? formatPrice(filters.max_price) : "Không giới hạn";

    card.innerHTML = `
      <div class="redirect-prompt-header">
        <span class="bot-avatar-inline">🤖</span>
        <span>Xem danh sách vé đầy đủ?</span>
      </div>
      <div class="redirect-prompt-body">
        <p>Tôi đã lọc được <strong>${total}</strong> chuyến cho tiêu chí này:</p>
        <ul>
          <li>✈️ Hành trình: <strong>${route}</strong></li>
          <li>📅 Ngày bay: <strong>${date}</strong></li>
          <li>🎟 Hạng ghế: <strong>${cls}</strong></li>
          <li>💰 Giá tối đa: <strong>${price}</strong></li>
        </ul>
      </div>
      <div class="redirect-prompt-actions">
        <button class="redirect-no-btn">Không</button>
        <button class="redirect-yes-btn">Có</button>
      </div>
    `;

    const yesBtn = card.querySelector(".redirect-yes-btn");
    const noBtn = card.querySelector(".redirect-no-btn");

    yesBtn.onclick = () => onAccept?.(filters);
    noBtn.onclick = () => {
      card.remove();
      onDecline?.();
    };

    return card;
  },

  // ===== Proactive Popup =====
  createProactivePopup(customer, cdp, onAccept, onDismiss) {
    const popup = document.createElement("div");
    popup.className = "proactive-popup";
    popup.innerHTML = `
      <button class="popup-close" id="popup-close">×</button>
      <div class="popup-avatar">
        <img src="assets/neo-avatar.svg" alt="NEO" onerror="this.style.display='none'">
      </div>
      <div class="popup-content">
        <p class="popup-greeting">Xin chào <strong>${customer.name.split(" ").pop()}</strong> 👋</p>
        <p class="popup-message">Sắp tới cuối tuần, ${customer.name.split(" ").pop()} có muốn đặt chuyến <strong>${cdp.favoriteRoute.origin} → ${cdp.favoriteRoute.destination}</strong> như thường lệ không ạ?</p>
        <div class="popup-offer">
          <span class="offer-tag">🎁 Ưu đãi</span>
          <span class="offer-text">${cdp.upgradeOffer}</span>
        </div>
      </div>
      <div class="popup-actions">
        <button class="popup-dismiss" id="popup-dismiss">Không, cảm ơn</button>
        <button class="popup-accept" id="popup-accept">Đặt ngay ›</button>
      </div>
    `;

    popup.querySelector("#popup-close").onclick = onDismiss;
    popup.querySelector("#popup-dismiss").onclick = onDismiss;
    popup.querySelector("#popup-accept").onclick = onAccept;

    return popup;
  },

  // ===== Group Advisory Card =====
  createGroupAdvisoryCard(results, state) {
    const best = results.find(r => r.cls === "economy") || results[0];
    const busClass = results.find(r => r.cls === "business");

    const card = document.createElement("div");
    card.className = "group-advisory-card bot-message";

    let passengerList = "";
    if (state.adults) passengerList += `<li>👨 ${state.adults} Người lớn</li>`;
    if (state.hasSenior) passengerList += `<li>👴 1 Người cao tuổi (≥60t) — Giảm 15% giá vé</li>`;
    if (state.children) passengerList += `<li>👦 ${state.children} Trẻ em</li>`;
    if (state.infants) passengerList += `<li>👶 ${state.infants} Em bé (<2 tuổi)</li>`;

    let adviceList = "";
    if (busClass) adviceList += `<li>🪑 Nếu gia đình cần thoải mái hơn, có thể cân nhắc <strong>hạng Thương gia</strong> (nếu còn chỗ) để ưu tiên và không gian tốt hơn.</li>`;
    if (state.needsWheelchair) adviceList += `<li>♿ Tôi sẽ đặt trước <strong>dịch vụ xe lăn miễn phí</strong> tại sân bay cho quý khách.</li>`;
    if (state.needsBassinet) adviceList += `<li>🛏 Em bé dưới 2 tuổi được hỗ trợ <strong>nôi treo vách ngăn (Bassinet) miễn phí</strong>. Tôi sẽ chọn <strong>hàng ghế Bulkhead</strong> cho gia đình.</li>`;

    card.innerHTML = `
      <div class="group-card-header">
        <span class="bot-avatar-inline">🤖</span>
        <span>Tôi đã phân tích yêu cầu của gia đình bạn:</span>
      </div>
      <div class="group-card-body">
        <div class="group-section">
          <h4>👥 Phân loại hành khách</h4>
          <ul>${passengerList}</ul>
        </div>
        ${adviceList ? `<div class="group-section advice-section"><h4>💡 Tư vấn của NEO</h4><ul>${adviceList}</ul></div>` : ""}
        <div class="group-section">
          <h4>✈️ Chuyến bay gợi ý</h4>
          <p><strong>${best.fn}</strong> · Khởi hành ${best.dep} · ${best.airline}</p>
        </div>
      </div>
    `;

    return card;
  },

  // ===== Check-in Boarding Pass =====
  createBoardingPass(boardingPass) {
    const card = document.createElement("div");
    card.className = "boarding-pass";

    card.innerHTML = `
      <div class="bp-header">
        <div class="bp-logo">🇻🇳 Vietnam Airlines</div>
        <div class="bp-title">Boarding Pass</div>
      </div>
      <div class="bp-body">
        <div class="bp-passenger">
          <span class="bp-label">PASSENGER</span>
          <span class="bp-value">${boardingPass.name}</span>
        </div>
        <div class="bp-route">
          <div class="bp-city">
            <span class="bp-airport-code">${getAirportCode(boardingPass.origin)}</span>
            <span class="bp-city-name">${boardingPass.origin}</span>
          </div>
          <div class="bp-plane-icon">✈</div>
          <div class="bp-city">
            <span class="bp-airport-code">${getAirportCode(boardingPass.destination)}</span>
            <span class="bp-city-name">${boardingPass.destination}</span>
          </div>
        </div>
        <div class="bp-details">
          <div class="bp-detail-item">
            <span class="bp-label">FLIGHT</span>
            <span class="bp-value">${boardingPass.flight}</span>
          </div>
          <div class="bp-detail-item">
            <span class="bp-label">DATE</span>
            <span class="bp-value">${formatDate(boardingPass.date)}</span>
          </div>
          <div class="bp-detail-item">
            <span class="bp-label">SEAT</span>
            <span class="bp-value seat-highlight">${boardingPass.seat}</span>
          </div>
          <div class="bp-detail-item">
            <span class="bp-label">CLASS</span>
            <span class="bp-value">${boardingPass.class === "business" ? "C (Business)" : "Y (Economy)"}</span>
          </div>
          <div class="bp-detail-item">
            <span class="bp-label">GATE</span>
            <span class="bp-value">${boardingPass.gate}</span>
          </div>
          <div class="bp-detail-item">
            <span class="bp-label">BOARDING</span>
            <span class="bp-value">${boardingPass.boardingTime}</span>
          </div>
        </div>
      </div>
      <div class="bp-barcode">
        <div class="barcode-lines">${generateBarcode()}</div>
        <span class="bp-pnr">${boardingPass.pnr}</span>
      </div>
    `;

    return card;
  },

  // ===== File Upload Area =====
  createFileUpload(onFile) {
    const wrapper = document.createElement("div");
    wrapper.className = "file-upload-area";
    wrapper.innerHTML = `
      <div class="upload-icon">📄</div>
      <p>Kéo thả file PDF/ảnh vào đây hoặc <label class="upload-label" for="file-input">chọn file</label></p>
      <p class="upload-hint">PDF, JPG, PNG · Tối đa 10MB</p>
      <input type="file" id="file-input" accept=".pdf,image/*" style="display:none">
    `;

    const fileInput = wrapper.querySelector("#file-input");
    wrapper.querySelector(".upload-label").onclick = (e) => {
      e.preventDefault();
      fileInput.click();
    };
    fileInput.onchange = (e) => { if (e.target.files[0]) onFile(e.target.files[0]); };

    // Drag and drop
    wrapper.ondragover = (e) => { e.preventDefault(); wrapper.classList.add("drag-over"); };
    wrapper.ondragleave = () => wrapper.classList.remove("drag-over");
    wrapper.ondrop = (e) => {
      e.preventDefault();
      wrapper.classList.remove("drag-over");
      if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
    };

    return wrapper;
  },

  // ===== Escalation Widget =====
  createEscalationWidget() {
    const widget = document.createElement("div");
    widget.className = "escalation-widget";
    widget.innerHTML = `
      <div class="escalation-header">
        <span>👤</span>
        <span>Kết nối với nhân viên hỗ trợ</span>
      </div>
      <p>Tôi đã chuyển yêu cầu của bạn đến nhân viên tổng đài. Thời gian chờ dự kiến: <strong>~3 phút</strong>.</p>
      <div class="escalation-options">
        <button class="esc-btn" onclick="alert('Demo: Mở Live Chat với tổng đài viên')">💬 Chat với nhân viên</button>
        <button class="esc-btn" onclick="alert('Demo: Gọi 1900 1100')">📞 Gọi 1900 1100</button>
      </div>
    `;
    return widget;
  }
};

function getAirportCode(city) {
  const codes = {
    "Hà Nội": "HAN", "Hồ Chí Minh": "SGN", "Đà Nẵng": "DAD",
    "Phú Quốc": "PQC", "Seoul": "ICN", "Singapore": "SIN",
    "Tokyo": "NRT", "Bangkok": "BKK", "Hong Kong": "HKG", "Sydney": "SYD"
  };
  return codes[city] || city.substring(0, 3).toUpperCase();
}

function generateBarcode() {
  let bars = "";
  for (let i = 0; i < 40; i++) {
    const w = Math.random() > 0.5 ? "wide" : "narrow";
    bars += `<span class="bar ${w}"></span>`;
  }
  return bars;
}

window.UI = UI;
window.getAirportCode = getAirportCode;
