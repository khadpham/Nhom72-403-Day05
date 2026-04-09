// ===================================================
// APP.JS - Main App Controller
// Wires up all flows and handles user interactions
// ===================================================

(function() {
  // ===== State =====
  let currentUser = null;  // Logged in user
  let pendingFlight = null;
  let pendingGroupState = null;
  let pendingThinkingRef = null;
  let lastRedirectPromptKey = null;
  let lastResolvedFlightFilters = null;
  let lastResolvedFlightTotal = 0;
  let lastResolvedPNR = null;
  const BACKEND_BASE_URL = window.NEO_BACKEND_URL || "http://127.0.0.1:8000";
  const USE_BACKEND_AGENT = true;
  const STORAGE_KEYS = {
    chatHistoryHtml: "neo_chat_history_html_v1",
    chatWidgetOpen: "neo_chat_widget_open_v1",
    backendSessionId: "neo_backend_session_id_v1",
    currentUserId: "neo_current_user_id_v1",
  };

  const createBackendSessionId = () => {
    return (window.crypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : `neo-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  };

  let backendSessionId = localStorage.getItem(STORAGE_KEYS.backendSessionId) || createBackendSessionId();
  localStorage.setItem(STORAGE_KEYS.backendSessionId, backendSessionId);

  const COMPLEX_SUPPORT_PATTERN = /(doi\s*ve|doi\s*chuyen|hoan\s*ve|hoan\s*tien|refund|mat\s*hanh\s*ly|that\s*lac\s*hanh\s*ly|hanh\s*ly\s*(bi\s*)?(hong|mat)|khieu\s*nai|boi\s*thuong|cham\s*chuyen|hoan\s*chuyen|huy\s*chuyen|delay|cancel|doi\s*ten\s*hanh\s*khach|sai\s*ten\s*ve|doi\s*thong\s*tin\s*ve)/i;
  const HUMAN_AGENT_REQUEST_PATTERN = /(tu\s*van\s*vien|nhan\s*vien|tong\s*dai|nguoi\s*that|ho\s*tro\s*truc\s*tiep|ket\s*noi\s*agent|ket\s*noi\s*tu\s*van)/i;
  const SUPPORTED_SCOPE_PATTERN = /(ve\s*may\s*bay|dat\s*ve|dat\s*cho|chuyen\s*bay|tra\s*cuu|check\s*-?in|pnr|hanh\s*ly|chon\s*ghe|xe\s*lan|noi\s*em\s*be|lotusmiles|thanh\s*toan|gia\s*ve|doi\s*ve|hoan\s*ve)/i;
  const OUT_OF_SCOPE_PATTERN = /(python|javascript|\bjava\b|c\+\+|code|lap\s*trinh|programming|thoi\s*tiet|weather|chung\s*khoan|stock|crypto|bong\s*da|world\s*cup|lich\s*su|toan\s*hoc|homework|bai\s*tap|dich\s*van\s*ban|viet\s*essay|viet\s*content)/i;
  const REDIRECT_REQUEST_PATTERN = /(chuyen\s*huong|chuyển\s*hướng|redirect|trang\s*gia\s*ve|trang\s*giá\s*vé|xem\s*gia\s*ve|xem\s*giá\s*vé|tickets?\.html|trang\s*ve|trang\s*vé)/i;
  const FEEDBACK_LOW_RATING_SET = new Set(["chua_tot", "te"]);
  const feedbackPromptedEvents = new Set();

  // ===== DOM References =====
  const chatInput = document.getElementById("chat-input");
  const sendBtn = document.getElementById("send-btn");
  const chatMessages = document.getElementById("chat-messages");
  const typingIndicator = document.getElementById("typing-indicator");
  const uploadTrigger = document.getElementById("upload-trigger");
  const chatWidget = document.getElementById("chat-widget");
  const chatToggle = document.getElementById("chat-toggle");
  const chatMinimize = document.getElementById("chat-minimize");
  const chatClose = document.getElementById("chat-close");
  const chatClear = document.getElementById("chat-clear");
  const userSelect = document.getElementById("user-select");
  const proactiveContainer = document.getElementById("proactive-container");
  const loginBtn = document.getElementById("login-btn");
  const userInfo = document.getElementById("user-info");

  if (!chatMessages || !typingIndicator || !uploadTrigger || !chatWidget || !chatToggle || !chatClose || !chatInput || !sendBtn) {
    console.warn("NEO chat widget markup not found. app.js is skipped on this page.");
    return;
  }

  // Init UI module
  UI.init(chatMessages, typingIndicator);

  let persistTimer = null;

  function hasRenderableMessages() {
    return Array.from(chatMessages.children).some((el) => el.id !== "typing-indicator");
  }

  function setChatWidgetOpen(isOpen) {
    chatWidget.classList.toggle("open", !!isOpen);
    chatToggle.style.display = isOpen ? "none" : "flex";
    localStorage.setItem(STORAGE_KEYS.chatWidgetOpen, isOpen ? "1" : "0");
  }

  function persistChatState() {
    const html = Array.from(chatMessages.children)
      .filter((el) => el.id !== "typing-indicator")
      .map((el) => el.outerHTML)
      .join("");

    localStorage.setItem(STORAGE_KEYS.chatHistoryHtml, html);
    localStorage.setItem(STORAGE_KEYS.chatWidgetOpen, chatWidget.classList.contains("open") ? "1" : "0");
    localStorage.setItem(STORAGE_KEYS.backendSessionId, backendSessionId);

    if (currentUser?.id) {
      localStorage.setItem(STORAGE_KEYS.currentUserId, currentUser.id);
    }
  }

  function schedulePersistChatState() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => persistChatState(), 120);
  }

  function restoreChatState() {
    const savedHtml = localStorage.getItem(STORAGE_KEYS.chatHistoryHtml);
    if (savedHtml) {
      chatMessages.innerHTML = savedHtml;
      typingIndicator.style.display = "none";
      chatMessages.appendChild(typingIndicator);

      // Các phần tương tác cũ sau khi restore sẽ mất handler, nên dọn để tránh click lỗi.
      chatMessages.querySelectorAll(".quick-replies, .file-upload-area, .service-feedback-card").forEach((el) => el.remove());
    }

    const widgetOpen = localStorage.getItem(STORAGE_KEYS.chatWidgetOpen) === "1";
    setChatWidgetOpen(widgetOpen);
  }

  function renderCurrentUserInfo() {
    if (!currentUser || !loginBtn || !userSelect || !userInfo) return;

    loginBtn.style.display = "none";
    userSelect.style.display = "none";
    userInfo.style.display = "flex";
    userInfo.innerHTML = `
      <div class="user-avatar-small">${currentUser.name[0]}</div>
      <div>
        <span class="user-name-small">${currentUser.name}</span>
        <span class="user-tier ${currentUser.tier.toLowerCase()}">${currentUser.tier}</span>
      </div>
    `;
  }

  function hydrateCurrentUserFromStorage() {
    const savedUserId = (localStorage.getItem(STORAGE_KEYS.currentUserId) || "").trim();
    if (!savedUserId || !window.MockDB?.customers) return;

    const found = MockDB.customers.find((c) => c.id === savedUserId);
    if (!found) return;

    currentUser = found;
    ChatEngine.currentUser = currentUser;
    renderCurrentUserInfo();
    bindBackendSessionUser(currentUser.id);
  }

  function setupPersistenceObserver() {
    const observer = new MutationObserver(() => {
      schedulePersistChatState();
    });

    observer.observe(chatMessages, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  restoreChatState();
  hydrateCurrentUserFromStorage();
  setupPersistenceObserver();
  window.addEventListener("beforeunload", persistChatState);

  // ===== Chat Open/Close =====
  chatToggle.addEventListener("click", () => {
    setChatWidgetOpen(true);
    if (!hasRenderableMessages()) {
      showWelcome();
    }
  });

  chatClose.addEventListener("click", () => {
    setChatWidgetOpen(false);
  });

  if (chatMinimize) {
    chatMinimize.addEventListener("click", () => {
      setChatWidgetOpen(false);
    });
  }

  if (chatClear) {
    chatClear.addEventListener("click", async () => {
      chatClear.disabled = true;
      try {
        await clearChatHistory();
      } finally {
        chatClear.disabled = false;
      }
    });
  }

  // ===== User Login Simulation =====
  if (loginBtn && userSelect) {
    loginBtn.addEventListener("click", async () => {
      const userId = userSelect.value;
      if (!userId) return;
      currentUser = MockDB.customers.find(c => c.id === userId);
      if (!currentUser) return;

      ChatEngine.currentUser = currentUser;
      localStorage.setItem(STORAGE_KEYS.currentUserId, currentUser.id);
      renderCurrentUserInfo();

      await bindBackendSessionUser(currentUser.id);

      // Check CDP profile and trigger proactive if applicable
      const cdp = MockAPI.getCDPProfile(currentUser.id);
      if (cdp && proactiveContainer) {
        setTimeout(() => triggerProactive(currentUser, cdp), 3000);
      } else {
        setTimeout(() => {
          setChatWidgetOpen(true);
          showPersonalizedWelcome(currentUser);
        }, 600);
      }
    });
  }

  async function bindBackendSessionUser(userId) {
    if (!USE_BACKEND_AGENT || !userId) return;

    try {
      const resp = await fetch(`${BACKEND_BASE_URL}/api/session/bind-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          session_id: backendSessionId,
          user_id: userId
        })
      });

      if (!resp.ok) return;

      const data = await resp.json();
      if (data?.session_id) {
        backendSessionId = data.session_id;
        localStorage.setItem(STORAGE_KEYS.backendSessionId, backendSessionId);
      }
    } catch (error) {
      console.warn("Cannot bind backend customer context:", error);
    }
  }

  function resetConversationState() {
    pendingFlight = null;
    pendingGroupState = null;
    pendingThinkingRef = null;
    lastRedirectPromptKey = null;
    lastResolvedFlightFilters = null;
    lastResolvedFlightTotal = 0;
    lastResolvedPNR = null;

    if (window.ChatEngine?.reset) {
      ChatEngine.reset();
    }
  }

  function clearChatMessagesUI() {
    Array.from(chatMessages.children)
      .filter((el) => el.id !== "typing-indicator")
      .forEach((el) => el.remove());

    typingIndicator.style.display = "none";
    chatMessages.appendChild(typingIndicator);
  }

  async function clearBackendHistoryIfPossible(sessionId) {
    if (!USE_BACKEND_AGENT || !sessionId) return;

    try {
      await fetch(`${BACKEND_BASE_URL}/api/history/${encodeURIComponent(sessionId)}`, {
        method: "DELETE"
      });
    } catch (error) {
      console.warn("Cannot clear backend history:", error);
    }
  }

  async function clearChatHistory() {
    const confirmed = window.confirm("Bạn có chắc muốn xóa toàn bộ lịch sử trò chuyện không?");
    if (!confirmed) return;

    const oldSessionId = backendSessionId;
    const userIdToRebind = currentUser?.id || null;

    clearThinkingBubble();
    resetConversationState();
    clearChatMessagesUI();

    localStorage.removeItem(STORAGE_KEYS.chatHistoryHtml);

    backendSessionId = createBackendSessionId();
    localStorage.setItem(STORAGE_KEYS.backendSessionId, backendSessionId);

    await clearBackendHistoryIfPossible(oldSessionId);

    if (userIdToRebind) {
      await bindBackendSessionUser(userIdToRebind);
    }

    await UI.addBotMessage("🧹 Đã xóa lịch sử trò chuyện. Mình bắt đầu phiên mới nhé!");
    UI.addQuickReplies(["Tìm vé máy bay", "Check-in online", "Chat với tư vấn viên"], handleQuickReply);
    persistChatState();
  }

  function createServiceFeedbackCard({ triggerEvent, metadata }) {
    const card = document.createElement("div");
    card.className = "service-feedback-card bot-message";
    card.innerHTML = `
      <div class="service-feedback-title">📝 Đánh giá chất lượng tư vấn</div>
      <p class="service-feedback-desc">Bạn thấy trải nghiệm vừa rồi thế nào?</p>
      <div class="feedback-rating-grid">
        <button class="feedback-rating-btn" data-rating="tot">Tốt</button>
        <button class="feedback-rating-btn" data-rating="on">Ổn</button>
        <button class="feedback-rating-btn" data-rating="chua_tot">Chưa tốt</button>
        <button class="feedback-rating-btn" data-rating="te">Tệ</button>
      </div>
      <div class="feedback-improvement-box" style="display:none;">
        <label for="feedback-note-${Date.now()}">Bạn muốn chúng tôi cải thiện điều gì?</label>
        <textarea class="feedback-note-input" rows="3" placeholder="Ví dụ: Trả lời ngắn hơn, rõ giá vé hơn..."></textarea>
      </div>
      <div class="feedback-actions-row">
        <button class="feedback-submit-btn" disabled>Gửi đánh giá</button>
      </div>
      <div class="feedback-status" aria-live="polite"></div>
    `;

    const ratingButtons = Array.from(card.querySelectorAll(".feedback-rating-btn"));
    const improvementBox = card.querySelector(".feedback-improvement-box");
    const noteInput = card.querySelector(".feedback-note-input");
    const submitBtn = card.querySelector(".feedback-submit-btn");
    const statusEl = card.querySelector(".feedback-status");

    let selectedRating = "";

    const updateSubmitState = () => {
      const noteText = (noteInput?.value || "").trim();
      const needNote = FEEDBACK_LOW_RATING_SET.has(selectedRating);
      submitBtn.disabled = !selectedRating || (needNote && !noteText);
    };

    ratingButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedRating = btn.dataset.rating || "";
        ratingButtons.forEach((item) => item.classList.toggle("active", item === btn));

        if (FEEDBACK_LOW_RATING_SET.has(selectedRating)) {
          improvementBox.style.display = "block";
        } else {
          improvementBox.style.display = "none";
          if (noteInput) noteInput.value = "";
        }

        updateSubmitState();
      });
    });

    if (noteInput) {
      noteInput.addEventListener("input", updateSubmitState);
    }

    submitBtn.addEventListener("click", async () => {
      if (!selectedRating) return;

      const noteText = (noteInput?.value || "").trim();
      if (FEEDBACK_LOW_RATING_SET.has(selectedRating) && !noteText) {
        statusEl.textContent = "Vui lòng nhập góp ý cải thiện cho mức đánh giá này.";
        statusEl.classList.add("error");
        return;
      }

      submitBtn.disabled = true;
      statusEl.textContent = "Đang gửi đánh giá...";
      statusEl.classList.remove("error", "success");

      const payload = {
        rating: selectedRating,
        trigger_event: triggerEvent,
        session_id: backendSessionId,
        user_id: currentUser?.id || localStorage.getItem(STORAGE_KEYS.currentUserId) || null,
        improvement_note: noteText || null,
        metadata: metadata || {},
      };

      try {
        const resp = await fetch(`${BACKEND_BASE_URL}/api/feedback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
        });

        const data = await resp.json();
        if (!resp.ok || !data?.ok) {
          throw new Error(data?.detail || "Không thể lưu đánh giá.");
        }

        statusEl.textContent = "✅ Cảm ơn bạn! Đánh giá đã được ghi nhận.";
        statusEl.classList.add("success");
        ratingButtons.forEach((btn) => {
          btn.disabled = true;
        });
        if (noteInput) noteInput.disabled = true;
      } catch (error) {
        statusEl.textContent = "⚠️ Gửi đánh giá chưa thành công, vui lòng thử lại.";
        statusEl.classList.add("error");
        console.warn("Cannot submit service feedback:", error);
        submitBtn.disabled = false;
      }
    });

    return card;
  }

  async function promptServiceFeedback(triggerEvent, metadata = {}) {
    if (!triggerEvent) return;
    const onceKey = `${triggerEvent}:${backendSessionId}`;
    if (feedbackPromptedEvents.has(onceKey)) return;
    feedbackPromptedEvents.add(onceKey);

    const card = createServiceFeedbackCard({ triggerEvent, metadata });
    await UI.addElement(card, 120);
  }

  // ===== UC-01: Proactive Greeting =====
  function triggerProactive(customer, cdp) {
    if (!proactiveContainer) return;

    const popup = UI.createProactivePopup(
      customer,
      cdp,
      () => {
        // Accept: open chat and pre-fill search
        popup.remove();
        setChatWidgetOpen(true);
        handleProactiveAccept(customer, cdp);
      },
      () => {
        // Dismiss
        popup.classList.add("popup-hide");
        setTimeout(() => popup.remove(), 300);
      }
    );
    proactiveContainer.appendChild(popup);
    setTimeout(() => popup.classList.add("popup-show"), 100);
  }

  async function handleProactiveAccept(customer, cdp) {
    if (!hasRenderableMessages()) {
      await showPersonalizedWelcome(customer);
    }

    UI.showTyping();
    const nextSaturday = getUpcomingDay(6); // Saturday
    const route = cdp.favoriteRoute;

    await UI.addBotMessage(
      `Để tôi tìm ngay chuyến ${route.origin} → ${route.destination} vào ${cdp.favoriteDay} tới (${formatDate(nextSaturday)}) cho ${customer.name.split(" ").pop()} ạ! 🔍`
    );

    UI.showTyping();
    await new Promise(r => setTimeout(r, 1200));

    let filteredResults = [];

    try {
      const exactResp = await fetch(`${BACKEND_BASE_URL}/api/flights/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          origin: route.origin,
          destination: route.destination,
          date: nextSaturday,
          limit: 12
        })
      });

      if (exactResp.ok) {
        const exactData = await exactResp.json();
        filteredResults = exactData?.flights || [];
      }

      if (!filteredResults.length) {
        const fallbackResp = await fetch(`${BACKEND_BASE_URL}/api/flights/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            origin: route.origin,
            destination: route.destination,
            limit: 4
          })
        });

        if (fallbackResp.ok) {
          const fallbackData = await fallbackResp.json();
          filteredResults = fallbackData?.flights || [];
        }
      }
    } catch (error) {
      console.warn("Cannot load proactive flights from backend:", error);
    }

    filteredResults.forEach(r => { r.origin = route.origin; r.destination = route.destination; });

    if (filteredResults.length > 0) {
      const resultContainer = UI.createFlightResultsContainer(
        filteredResults,
        (flight) => onFlightSelected(flight, { adults: 1 }),
        `${filteredResults.length} chuyến bay ${route.origin} → ${route.destination}:`
      );
      await UI.addElement(resultContainer, 200);
      UI.addQuickReplies(["Chọn giá rẻ nhất", "Chỉ Vietnam Airlines", "Thêm điều kiện"], handleQuickReply);
    }
  }

  // ===== Welcome Message =====
  async function showWelcome() {
    UI.showTyping();
    await UI.addBotMessage("Xin chào! Tôi là NEO, trợ lý AI của Vietnam Airlines. ✈️");
    UI.showTyping();
    await UI.addBotMessage(
      "Tôi có thể giúp bạn:\n• 🔍 Tìm và lọc vé theo nhiều điều kiện\n• 👨‍👩‍👧‍👦 Tư vấn đặt vé cho nhóm, gia đình\n• 📄 Check-in online bằng mã PNR\n\nBạn cần hỗ trợ gì hôm nay?"
    );
    UI.addQuickReplies(
      ["Tìm vé Hà Nội - Đà Nẵng", "Check-in online", "Vé cho gia đình 4 người"],
      handleQuickReply
    );
  }

  async function showPersonalizedWelcome(customer) {
    UI.showTyping();
    const tierLabel = customer.tier === "Platinum" ? "Bạch Kim" : customer.tier === "Gold" ? "Vàng" : "Bạc";
    await UI.addBotMessage(
      `Xin chào ${customer.name.split(" ").pop()}! Tôi là NEO ✈️\nChào mừng Hội viên Lotusmiles hạng ${tierLabel} quay trở lại. Bạn cần tôi hỗ trợ gì hôm nay?`
    );
  }

  // ===== Handle message send =====
  sendBtn.addEventListener("click", sendMessage);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = "";

    // Remove any quick replies
    document.querySelectorAll(".quick-replies").forEach(el => el.remove());

    UI.addUserMessage(text);
    showThinkingBubble();

    setTimeout(() => processUserMessage(text), 280);
  }

  function showThinkingBubble() {
    clearThinkingBubble();
    pendingThinkingRef = UI.showThinkingBubble("...");
  }

  function clearThinkingBubble() {
    if (pendingThinkingRef) {
      UI.removeThinkingBubble(pendingThinkingRef);
      pendingThinkingRef = null;
    }
    UI.hideTyping();
  }

  function buildFilteredTicketUrl(filters) {
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== "") {
        params.set(k, String(v));
      }
    });
    return `tickets.html?${params.toString()}`;
  }

  function openFilteredTicketPage(filters, options = {}) {
    const { target = "same-tab" } = options;
    const url = buildFilteredTicketUrl(filters);

    persistChatState();

    if (target === "new-tab") {
      const popup = window.open(url, "_blank", "noopener");
      return Boolean(popup);
    }

    window.location.href = url;
    return true;
  }

  function openCheckinPage(pnrCode) {
    const params = new URLSearchParams();
    if (pnrCode) {
      params.set("pnr", String(pnrCode).trim().toUpperCase());
    }
    persistChatState();
    window.location.href = `checkin.html?${params.toString()}`;
  }

  async function suggestTicketRedirect(filters, total, introMessage) {
    const displayTotal = Number(total) > 0 ? Number(total) : "một số";

    clearThinkingBubble();
    await UI.addBotMessage(
      `${introMessage}\n\nBạn có thể bấm nút bên dưới để mở trang chọn vé ở tab mới bất kỳ lúc nào.`,
      { stream: false, delay: 80 }
    );

    const card = UI.createRedirectPromptCard(displayTotal, filters, () => {
      const opened = openFilteredTicketPage(filters, { target: "new-tab" });
      if (!opened) {
        UI.addBotMessage("⚠️ Trình duyệt đang chặn tab mới. Bạn hãy cho phép popup và bấm lại nút này nhé.", {
          stream: false,
          delay: 80,
        });
        return;
      }

      promptServiceFeedback("ticket_page_open", {
        total: displayTotal,
        origin: filters?.origin || null,
        destination: filters?.destination || null,
        date: filters?.date || null,
      });
    });

    const yesBtn = card.querySelector(".redirect-yes-btn");
    const noBtn = card.querySelector(".redirect-no-btn");
    if (yesBtn) yesBtn.textContent = "Đến trang chọn vé";
    if (noBtn) noBtn.remove();

    await UI.addElement(card, 120);
    return true;
  }

  async function maybeSuggestTicketSelection(userText) {
    const normalizedText = normalizeIntentText(userText);
    const explicitRedirectRequest = REDIRECT_REQUEST_PATTERN.test(normalizedText);

    try {
      const resp = await fetch(`${BACKEND_BASE_URL}/api/flights/from-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          user_message: userText,
          limit: 200
        })
      });

      if (!resp.ok) return;
      const data = await resp.json();
      if (data?.should_prompt_redirect && data?.total) {
        const filters = data.filters || {};
        lastResolvedFlightFilters = filters;
        lastResolvedFlightTotal = Number(data.total) || 0;
        const currentPromptKey = JSON.stringify(filters);
        if (!explicitRedirectRequest && currentPromptKey === lastRedirectPromptKey) {
          return false;
        }
        lastRedirectPromptKey = currentPromptKey;
        return await suggestTicketRedirect(
          filters,
          lastResolvedFlightTotal,
          `Tôi đã lọc được ${data.total} chuyến từ dữ liệu Vietnam Airlines theo đúng tiêu chí của bạn.`
        );
      }

      if (explicitRedirectRequest && lastResolvedFlightFilters) {
        return await suggestTicketRedirect(
          lastResolvedFlightFilters,
          lastResolvedFlightTotal || 0,
          "Đây là bộ lọc gần nhất bạn đã xác nhận."
        );
      }
    } catch (error) {
      console.warn("Cannot suggest ticket selection:", error);

      if (explicitRedirectRequest && lastResolvedFlightFilters) {
        return await suggestTicketRedirect(
          lastResolvedFlightFilters,
          lastResolvedFlightTotal || 0,
          "Backend tạm chậm, nhưng tôi vẫn giữ sẵn bộ lọc gần nhất để bạn mở trang vé."
        );
      }
    }

    return false;
  }

  async function processUserMessage(text) {
    if (isHumanAdvisorIntent(text) || isComplexSupportRequest(text)) {
      clearThinkingBubble();
      await UI.addBotMessage(
        "Mình đã chuyển sang tư vấn viên ngay cho bạn. Vui lòng bấm 1 trong 2 nút bên dưới để gọi hoặc chat trực tiếp.",
        { stream: false, delay: 120 }
      );
      const widget = UI.createEscalationWidget();
      await UI.addElement(widget, 200);
      return;
    }

    if (isOutOfScopeRequest(text)) {
      clearThinkingBubble();
      await UI.addBotMessage(
        "Mình chỉ hỗ trợ dịch vụ bay Vietnam Airlines (tìm vé, check-in, hành lý, Lotusmiles). Bạn muốn mình hỗ trợ mục nào?",
        { stream: false, delay: 100 }
      );
      UI.addQuickReplies(["Tìm vé máy bay", "Check-in online", "Chat với tư vấn viên"], handleQuickReply);
      return;
    }

    if (USE_BACKEND_AGENT) {
      const handledByDirectPNR = await tryDirectPNRLookup(text);
      if (handledByDirectPNR) return;
    }

    if (USE_BACKEND_AGENT) {
      const handledByBackend = await processUserMessageWithBackend(text);
      if (handledByBackend) {
        await maybeSuggestTicketSelection(text);
        return;
      }
    }

    clearThinkingBubble();

    ChatEngine.process(text, {
      onSearchResults: async (results, state) => {
        const msg = results.length === 1
          ? `Tôi tìm được 1 chuyến bay phù hợp với yêu cầu của bạn:`
          : `Tôi tìm được ${results.length} chuyến bay phù hợp. Đây là các lựa chọn:`;

        await UI.addBotMessage(msg);
        const resultsEl = UI.createFlightResultsContainer(
          results,
          (f) => onFlightSelected(f, { adults: 1 }),
          ""
        );
        await UI.addElement(resultsEl, 200);
        UI.addQuickReplies(["Giá rẻ nhất", "Vietnam Airlines", "Thêm bộ lọc", "Tìm chuyến khác"], handleQuickReply);
      },

      onGroupResults: async (results, state) => {
        pendingGroupState = state;
        const advisory = UI.createGroupAdvisoryCard(results, state);
        await UI.addElement(advisory, 300);

        const econResults = results.filter(r => r.cls === "economy");
        const busResults = results.filter(r => r.cls === "business");
        const allResults = [...busResults, ...econResults];

        if (allResults.length > 0) {
          const resultsEl = UI.createFlightResultsContainer(
            allResults,
            (f) => onFlightSelected(f, state),
            "Chuyến bay phù hợp cho gia đình:"
          );
          await UI.addElement(resultsEl, 300);
        }

        UI.addQuickReplies(["Xác nhận đặt chuyến này", "Muốn so sánh giá", "Đổi ngày bay"], handleQuickReply);
      },

      onAskFollowUp: async (question) => {
        await UI.addBotMessage(question);
      },

      onNoResults: async (state) => {
        await UI.addBotMessage(
          `Rất tiếc, tôi không tìm thấy chuyến bay ${state.origin || ""} → ${state.destination} phù hợp với yêu cầu. ` +
          `Bạn có muốn nới lỏng điều kiện (ví dụ: thêm ngày khác hoặc bỏ giới hạn giá) không?`
        );
        UI.addQuickReplies(["Xem tất cả chuyến bay", "Đổi ngày bay", "Không có điều kiện giá"], handleQuickReply);
      },

      onClarify: async (count) => {
        const msgs = [
          "Tôi muốn chắc chắn tôi hiểu đúng yêu cầu của bạn. Bạn muốn bay vào ngày nào và đến đâu chính xác ạ?",
          "Xin lỗi, có vẻ yêu cầu có một số điểm chưa rõ. Bạn có thể xác nhận lại: điểm đến và ngày bay không ạ?",
        ];
        await UI.addBotMessage(msgs[count - 1] || msgs[0]);
      },

      onEscalate: async () => {
        await UI.addBotMessage("Tôi hiểu yêu cầu của bạn có vẻ phức tạp. Để tôi kết nối bạn với nhân viên hỗ trợ! 👤");
        const widget = UI.createEscalationWidget();
        await UI.addElement(widget, 500);
        ChatEngine.reset();
      },

      onCheckinFound: async (booking) => {
        await UI.addBotMessage(`Tìm thấy thông tin đặt chỗ PNR ${booking.pnr}! Đây là thẻ lên máy bay của bạn:`);
        const bp = UI.createBoardingPass(MockAPI.doCheckin(booking).boardingPass);
        await UI.addElement(bp, 400);
        UI.addQuickReplies(["Gửi qua Email", "Tìm chuyến khác"], handleQuickReply);
      },

      onCheckinNotFound: async (pnr) => {
        await UI.addBotMessage(`Tôi không tìm thấy mã đặt chỗ "${pnr}". Bạn có thể kiểm tra lại mã PNR gồm 6 ký tự trên vé không ạ?\n\n💡 Thử với: ABC123, XYZ789, DEF456`);
      },

      onAskForPNR: async () => {
        await UI.addBotMessage("Bạn muốn check-in online? Tôi cần mã đặt chỗ (PNR) gồm 6 ký tự trên vé của bạn. Hoặc upload file PDF vé điện tử:");
        const uploadArea = UI.createFileUpload(handleFileUpload);
        await UI.addElement(uploadArea, 300);
      },

      onUnknown: async () => {
        const responses = [
          "Tôi chưa hiểu rõ yêu cầu này lắm. Bạn có thể nói rõ hơn không ạ? Ví dụ: \"Tìm vé Hà Nội đi Đà Nẵng ngày 15/4\"",
          "Xin lỗi, tôi chỉ hỗ trợ các yêu cầu liên quan đến đặt vé, tra cứu chuyến bay và check-in. Bạn cần tôi giúp gì ạ?",
        ];
        await UI.addBotMessage(responses[Math.floor(Math.random() * responses.length)]);
        UI.addQuickReplies(["Tìm vé máy bay", "Check-in online", "Hỗ trợ khác"], handleQuickReply);
      }
    });
  }

  function looksLikeDirectPNRInput(text) {
    const normalized = (text || "").trim().toUpperCase();
    return /^[A-Z0-9]{6}$/.test(normalized) || /^BK[_-]?\d{4}$/.test(normalized);
  }

  function normalizeIntentText(text) {
    return (text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function isComplexSupportRequest(text) {
    const normalized = normalizeIntentText(text);
    return COMPLEX_SUPPORT_PATTERN.test(normalized);
  }

  function isHumanAdvisorIntent(text) {
    const normalized = normalizeIntentText(text);
    return HUMAN_AGENT_REQUEST_PATTERN.test(normalized);
  }

  function isOutOfScopeRequest(text) {
    const normalized = normalizeIntentText(text);
    if (SUPPORTED_SCOPE_PATTERN.test(normalized)) return false;
    return OUT_OF_SCOPE_PATTERN.test(normalized);
  }

  async function tryDirectPNRLookup(text) {
    if (!looksLikeDirectPNRInput(text)) {
      return false;
    }

    const candidate = (text || "").trim().toUpperCase();

    try {
      const resp = await fetch(`${BACKEND_BASE_URL}/api/checkin/pnr`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          pnr_code: text
        })
      });

      if (!resp.ok) {
        return false;
      }

      const data = await resp.json();
      clearThinkingBubble();

      if (data?.ok) {
        lastResolvedPNR = (data?.pnr || candidate || "").toString().toUpperCase();
        await UI.addBotMessage(data.details || "✅ Đã tra cứu PNR thành công.", { stream: false, delay: 120 });
        await UI.addBotMessage(
          "Thông tin đã xác nhận. Đang chuyển bạn sang web check-in để chọn ghế trực quan...",
          { stream: false, delay: 120 }
        );
        setTimeout(() => openCheckinPage(lastResolvedPNR), 260);
      } else {
        await UI.addBotMessage(
          data?.message || "Tôi chưa tìm thấy PNR hợp lệ. Bạn thử lại mã gồm 6 ký tự nhé.",
          { stream: false, delay: 120 }
        );
      }

      return true;
    } catch (error) {
      console.warn("Direct PNR lookup failed:", error);
      return false;
    }
  }

  async function processUserMessageWithBackend(text) {
    try {
      const streamResp = await fetch(`${BACKEND_BASE_URL}/api/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          user_message: text,
          session_id: backendSessionId,
          user_id: currentUser ? currentUser.id : null
        })
      });

      if (!streamResp.ok || !streamResp.body) {
        throw new Error(`Backend stream HTTP ${streamResp.status}`);
      }

      clearThinkingBubble();
      const streamRef = UI.startBotStreamMessage("");
      const reader = streamResp.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let hasChunk = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let delimiterIndex = -1;
        while ((delimiterIndex = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, delimiterIndex).trim();
          buffer = buffer.slice(delimiterIndex + 2);

          if (!rawEvent.startsWith("data:")) continue;
          const eventPayload = rawEvent.slice(5).trim();
          if (!eventPayload) continue;

          let eventData = null;
          try {
            eventData = JSON.parse(eventPayload);
          } catch {
            continue;
          }

          if (eventData.type === "session" && eventData.session_id) {
            backendSessionId = eventData.session_id;
            localStorage.setItem(STORAGE_KEYS.backendSessionId, backendSessionId);
          }

          if (eventData.type === "chunk") {
            hasChunk = true;
            UI.appendBotStreamChunk(streamRef, eventData.content || "");
          }

          if (eventData.type === "warning") {
            UI.appendBotStreamChunk(streamRef, `\n\n⚠️ ${eventData.message || "Backend đang ở chế độ dự phòng."}`);
          }

          if (eventData.type === "error") {
            UI.appendBotStreamChunk(streamRef, eventData.message || "Xin lỗi, backend đang gặp lỗi.");
          }
        }
      }

      if (!hasChunk) {
        UI.appendBotStreamChunk(streamRef, "Xin lỗi, tôi chưa có phản hồi phù hợp.");
      }

      return true;
    } catch (streamError) {
      console.warn("Streaming backend unavailable, fallback to non-stream endpoint:", streamError);

      try {
        const resp = await fetch(`${BACKEND_BASE_URL}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            user_message: text,
            session_id: backendSessionId,
            user_id: currentUser ? currentUser.id : null
          })
        });

        if (!resp.ok) {
          throw new Error(`Backend HTTP ${resp.status}`);
        }

        const data = await resp.json();
        if (data.session_id) {
          backendSessionId = data.session_id;
          localStorage.setItem(STORAGE_KEYS.backendSessionId, backendSessionId);
        }

        clearThinkingBubble();
        await UI.addBotMessage(data.answer || "Xin lỗi, tôi chưa có phản hồi phù hợp.", { stream: false, delay: 120 });
        return true;
      } catch (error) {
        console.warn("Backend unavailable:", error);
      }

      clearThinkingBubble();
      await UI.addBotMessage(
        "⚠️ Backend hiện chưa phản hồi nên tôi chưa thể tra cứu dữ liệu thật từ vna_master_seatmap.csv. Bạn vui lòng thử lại sau ít phút nhé."
      );
      return true;
    }
  }

  // ===== File Upload Handler (UC-04) =====
  async function handleFileUpload(file) {
    document.querySelectorAll(".file-upload-area").forEach(el => el.remove());
    UI.addUserMessage(`📎 ${file.name}`);
    UI.showTyping();

    if (USE_BACKEND_AGENT) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const resp = await fetch(`${BACKEND_BASE_URL}/api/checkin/upload`, {
          method: "POST",
          body: formData
        });

        if (resp.ok) {
          const data = await resp.json();
          const extractionNote = data?.api_cost
            ? `\n\n💡 Trích xuất file: ${data.extraction_method || "local"} · Chi phí API: ${data.api_cost}`
            : "";

          if (data?.ok) {
            lastResolvedPNR = (data?.pnr || "").toString().toUpperCase();
            await UI.addBotMessage(`${data.details || "✅ Đã tra cứu thành công."}${extractionNote}`, {
              stream: false,
              delay: 120
            });
            await UI.addBotMessage(
              "Đang chuyển bạn sang web check-in để chọn ghế theo sơ đồ máy bay 6 ghế/hàng...",
              { stream: false, delay: 120 }
            );
            setTimeout(() => openCheckinPage(lastResolvedPNR), 260);
            return;
          }

          await UI.addBotMessage(
            `${data?.message || "Tôi chưa trích xuất được PNR từ file này."}${extractionNote}`,
            { stream: false, delay: 120 }
          );
          UI.addQuickReplies(["Nhập mã PNR", "Tải lại file khác"], handleQuickReply);
          return;
        }
      } catch (error) {
        console.warn("Upload check-in endpoint unavailable, fallback to local demo:", error);
      }
    }

    await new Promise(r => setTimeout(r, 1000));
    await UI.addBotMessage(
      "Tôi chưa thể xử lý file ở thời điểm này. Bạn vui lòng nhập trực tiếp mã đặt chỗ (PNR) gồm 6 ký tự để check-in nhanh nhé."
    );
  }

  // ===== Quick Reply Handler =====
  function handleQuickReply(option) {
    UI.addUserMessage(option);
    UI.showTyping();

    // Simulate specific quick reply actions
    setTimeout(async () => {
      const t = option.toLowerCase();

      if (t.includes("giá rẻ nhất") || t.includes("rẻ nhất")) {
        await UI.addBotMessage("Tôi đang ưu tiên chuyến giá thấp nhất theo dữ liệu hiện tại...");
        processUserMessage("Tìm vé giá rẻ nhất");
      } else if (t.includes("vietnam airlines") || t.includes("vna")) {
        if (lastResolvedFlightFilters) {
          await suggestTicketRedirect(
            lastResolvedFlightFilters,
            lastResolvedFlightTotal || 0,
            "Bạn có thể xem ngay danh sách vé Vietnam Airlines theo bộ lọc gần nhất."
          );
        } else {
          processUserMessage("Tìm vé Vietnam Airlines");
        }
      } else if (t.includes("check-in ngay") || t.includes("abc123")) {
        await UI.addBotMessage("Tôi sẽ tra cứu PNR trực tiếp từ dữ liệu seatmap Vietnam Airlines.");
        processUserMessage("NHG8IQ");
      } else if (t.includes("tiếp tục check-in")) {
        if (lastResolvedPNR) {
          await UI.addBotMessage("Đang chuyển bạn sang web check-in để chọn ghế.");
          openCheckinPage(lastResolvedPNR);
        } else {
          await UI.addBotMessage("Bạn vui lòng cung cấp mã PNR trước để tôi mở web check-in chính xác.");
        }
      } else if (t.includes("tìm vé hà nội") || t.includes("hà nội - đà nẵng")) {
        processUserMessage("Tìm vé Hà Nội Đà Nẵng ngày 15/04/2026");
      } else if (t.includes("check-in online")) {
        processUserMessage("Tôi muốn check-in online");
      } else if (t.includes("gia đình 4 người") || t.includes("nhóm")) {
        processUserMessage("Tôi cần tìm vé cho gia đình 4 người đi Phú Quốc, có 1 bà cụ 68 tuổi đau khớp và 1 bé 1,5 tuổi");
      } else if (t.includes("xác nhận đặt")) {
        if (pendingFlight) {
          const panel = UI.createConfirmationPanel(
            pendingFlight,
            pendingGroupState || { adults: 1 },
            (flight, total) => showPaymentRedirect(flight, total),
            () => {
              UI.addBotMessage("Được rồi, bạn muốn thay đổi điều gì? Ngày bay, hạng ghế, hay số hành khách?");
            }
          );
          await UI.addElement(panel, 300);
        }
      } else if (t.includes("gửi qua email")) {
        await UI.addBotMessage("✉️ Thẻ lên máy bay đã được gửi đến email của bạn. Chúc bạn chuyến bay vui vẻ! ✈️");
      } else if (t.includes("nhân viên") || t.includes("tư vấn viên") || t.includes("hỗ trợ khác")) {
        const widget = UI.createEscalationWidget();
        await UI.addElement(widget, 300);
      } else {
        processUserMessage(option);
      }
    }, 800);
  }

  // ===== Flight Selected Handler =====
  async function onFlightSelected(flight, extraInfo) {
    pendingFlight = flight;
    pendingGroupState = extraInfo;

    UI.showTyping();
    await new Promise(r => setTimeout(r, 600));
    await UI.addBotMessage(`Bạn đã chọn chuyến ${flight.fn} của ${flight.airline}. Để tôi tóm tắt thông tin trước khi bạn quyết định:`);

    const panel = UI.createConfirmationPanel(
      flight,
      extraInfo,
      (f, total) => showPaymentRedirect(f, total),
      () => {
        UI.addBotMessage("Được rồi, bạn muốn thay đổi điều gì? Tôi có thể giúp lọc lại chuyến bay.");
      }
    );

    await UI.addElement(panel, 400);
  }

  // ===== Payment Redirect (AI does NOT pay) =====
  async function showPaymentRedirect(flight, totalPrice) {
    document.querySelectorAll(".confirmation-panel").forEach(el => {
      el.querySelector("#btn-confirm").disabled = true;
      el.querySelector("#btn-confirm").textContent = "Đã tạo phương án mở trang vé";
    });

    const selectedClass = (flight.cls || flight.class || "economy").toString().toLowerCase();
    const redirectFilters = {
      origin: flight.origin || "",
      destination: flight.destination || "",
      date: flight.date || null,
      max_price: Math.round(Number(flight.price) || 0),
      flight_class: selectedClass,
      selected_flight: flight.fn || flight.flight_number || "",
      selected_class: selectedClass,
    };
    lastResolvedFlightFilters = redirectFilters;
    await suggestTicketRedirect(
      redirectFilters,
      lastResolvedFlightTotal || 0,
      "Tôi đã xác nhận đúng thông tin chuyến bay. Bạn có thể tiếp tục bằng nút mở trang chọn vé bên dưới."
    );
  }

  // ===== Upload button in input bar =====
  if (uploadTrigger) {
    uploadTrigger.addEventListener("click", () => {
      const uploadArea = UI.createFileUpload(handleFileUpload);
      chatMessages.appendChild(uploadArea);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      ChatEngine.currentFlow = "CHECKIN";
      ChatEngine.flowState.waitingForPNR = true;
    });
  }

  // ===== Utility =====
  function getUpcomingDay(dayOfWeek) {
    const today = new Date();
    const current = today.getDay();
    let diff = dayOfWeek - current;
    if (diff <= 0) diff += 7;
    const target = new Date(today);
    target.setDate(today.getDate() + diff);
    return target.toISOString().split("T")[0];
  }

  // ===== Payment Simulation =====
  window.showPaymentSimulation = function(event, flightNum, price) {
    event.preventDefault();
    const overlay = document.createElement("div");
    overlay.className = "payment-overlay";
    overlay.innerHTML = `
      <div class="payment-modal">
        <div class="payment-modal-header">
          <span>🔒 Trang Thanh Toán Vietnam Airlines</span>
          <button onclick="this.closest('.payment-overlay').remove()">×</button>
        </div>
        <div class="payment-modal-body">
          <div class="payment-demo-notice">
            <span>⚠️ Demo Mode</span>
            <p>Đây là trang thanh toán giả lập. Trong hệ thống thật, người dùng sẽ được redirect đến cổng thanh toán chính thức của Vietnam Airlines.</p>
          </div>
          <div class="payment-summary">
            <span>Chuyến bay: <strong>${flightNum}</strong></span>
            <span>Tổng tiền: <strong>${price}</strong></span>
          </div>
          <p style="text-align:center;color:#64748b;font-size:13px;margin-top:16px">AI (NEO) không thực hiện thanh toán. Người dùng tự quyết định và thanh toán.</p>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  };

})();
