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
  const BACKEND_BASE_URL = window.NEO_BACKEND_URL || "http://127.0.0.1:8000";
  const USE_BACKEND_AGENT = true;
  let backendSessionId = (window.crypto && window.crypto.randomUUID)
    ? window.crypto.randomUUID()
    : `neo-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  // ===== DOM References =====
  const chatInput = document.getElementById("chat-input");
  const sendBtn = document.getElementById("send-btn");
  const chatMessages = document.getElementById("chat-messages");
  const typingIndicator = document.getElementById("typing-indicator");
  const uploadTrigger = document.getElementById("upload-trigger");
  const chatWidget = document.getElementById("chat-widget");
  const chatToggle = document.getElementById("chat-toggle");
  const chatClose = document.getElementById("chat-close");
  const userSelect = document.getElementById("user-select");
  const proactiveContainer = document.getElementById("proactive-container");
  const loginBtn = document.getElementById("login-btn");
  const userInfo = document.getElementById("user-info");

  // Init UI module
  UI.init(chatMessages, typingIndicator);

  // ===== Chat Open/Close =====
  chatToggle.addEventListener("click", () => {
    chatWidget.classList.add("open");
    chatToggle.style.display = "none";
    if (!chatMessages.hasChildNodes()) {
      showWelcome();
    }
  });

  chatClose.addEventListener("click", () => {
    chatWidget.classList.remove("open");
    chatToggle.style.display = "flex";
  });

  // ===== User Login Simulation =====
  loginBtn.addEventListener("click", () => {
    const userId = userSelect.value;
    if (!userId) return;
    currentUser = MockDB.customers.find(c => c.id === userId);
    if (!currentUser) return;

    ChatEngine.currentUser = currentUser;

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

    // Check CDP profile and trigger proactive if applicable
    const cdp = MockAPI.getCDPProfile(currentUser.id);
    if (cdp) {
      setTimeout(() => triggerProactive(currentUser, cdp), 3000);
    } else {
      setTimeout(() => {
        chatWidget.classList.add("open");
        chatToggle.style.display = "none";
        showPersonalizedWelcome(currentUser);
      }, 1500);
    }
  });

  // ===== UC-01: Proactive Greeting =====
  function triggerProactive(customer, cdp) {
    const popup = UI.createProactivePopup(
      customer,
      cdp,
      () => {
        // Accept: open chat and pre-fill search
        popup.remove();
        chatWidget.classList.add("open");
        chatToggle.style.display = "none";
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
    if (!chatMessages.hasChildNodes()) {
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

    const results = MockAPI.searchFlights({
      origin: route.origin,
      destination: route.destination,
      date: nextSaturday,
      cls: "any"
    });

    const filteredResults = results.length > 0 ? results : MockAPI.searchFlights({
      origin: route.origin,
      destination: route.destination,
      cls: "any"
    }).slice(0, 4);

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

  function openFilteredTicketPage(filters) {
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== "") {
        params.set(k, String(v));
      }
    });
    window.location.href = `tickets.html?${params.toString()}`;
  }

  async function maybePromptRedirectToTicketPage(userText) {
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
      if (!data?.should_prompt_redirect || !data?.total) return;

      const promptKey = JSON.stringify(data.filters || {});
      if (promptKey === lastRedirectPromptKey) return;
      lastRedirectPromptKey = promptKey;

      const promptCard = UI.createRedirectPromptCard(
        data.total,
        data.filters || {},
        (filters) => openFilteredTicketPage(filters),
        () => {
          lastRedirectPromptKey = null;
        }
      );

      await UI.addElement(promptCard, 180);
    } catch (error) {
      console.warn("Cannot load redirect suggestion:", error);
    }
  }

  async function processUserMessage(text) {
    if (USE_BACKEND_AGENT) {
      const handledByDirectPNR = await tryDirectPNRLookup(text);
      if (handledByDirectPNR) return;
    }

    if (USE_BACKEND_AGENT) {
      const handledByBackend = await processUserMessageWithBackend(text);
      if (handledByBackend) return;
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

  async function tryDirectPNRLookup(text) {
    if (!looksLikeDirectPNRInput(text)) {
      return false;
    }

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
        await UI.addBotMessage(data.details || "✅ Đã tra cứu PNR thành công.", { stream: false, delay: 120 });
        UI.addQuickReplies(["Tiếp tục check-in", "Tìm chuyến bay khác"], handleQuickReply);
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

      await maybePromptRedirectToTicketPage(text);

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
        }

        clearThinkingBubble();
        await UI.addBotMessage(data.answer || "Xin lỗi, tôi chưa có phản hồi phù hợp.", { stream: false, delay: 120 });
        await maybePromptRedirectToTicketPage(text);
        return true;
      } catch (error) {
        console.warn("Backend unavailable, fallback to mock flow:", error);
      }

      clearThinkingBubble();
      await UI.addBotMessage(
        "⚠️ Backend hiện chưa phản hồi, tôi chuyển tạm sang chế độ demo cục bộ để không gián đoạn hỗ trợ nhé."
      );
      return false;
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
            await UI.addBotMessage(`${data.details || "✅ Đã tra cứu thành công."}${extractionNote}`, {
              stream: false,
              delay: 120
            });
            UI.addQuickReplies(["Tiếp tục check-in", "Nhập mã PNR khác"], handleQuickReply);
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
        await UI.addBotMessage("Tôi đang sắp xếp theo giá từ thấp đến cao cho bạn...");
        handleQuickReply("Tìm vé Hà Nội - Đà Nẵng"); // re-trigger with no filters
      } else if (t.includes("vietnam airlines") || t.includes("vna")) {
        const state = ChatEngine.flowState;
        state.class = "any";
        const results = MockAPI.searchFlights({
          origin: state.origin || "Hà Nội",
          destination: state.destination || "Đà Nẵng",
          date: state.date,
          cls: "any"
        }).filter(r => r.airline === "Vietnam Airlines");
        results.forEach(r => { r.origin = state.origin || "Hà Nội"; r.destination = state.destination || "Đà Nẵng"; });
        if (results.length) {
          await UI.addBotMessage(`Đây là ${results.length} chuyến của Vietnam Airlines:`);
          const el = UI.createFlightResultsContainer(results, (f) => onFlightSelected(f, { adults: 1 }), "");
          await UI.addElement(el, 200);
        } else {
          await UI.addBotMessage("Không có chuyến Vietnam Airlines nào phù hợp trong ngày đó. Thử ngày khác nhé?");
        }
      } else if (t.includes("check-in ngay") || t.includes("abc123")) {
        const booking = MockAPI.lookupPNR("ABC123");
        await UI.addBotMessage("✅ Check-in thành công! Đây là thẻ lên máy bay của bạn:");
        const bp = UI.createBoardingPass(MockAPI.doCheckin(booking).boardingPass);
        await UI.addElement(bp, 400);
      } else if (t.includes("tìm vé hà nội") || t.includes("hà nội - đà nẵng")) {
        ChatEngine.reset();
        ChatEngine.flowState = { origin: "Hà Nội", destination: "Đà Nẵng", date: "2026-04-15" };
        processUserMessage("Tìm vé Hà Nội Đà Nẵng");
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
      } else if (t.includes("nhân viên") || t.includes("hỗ trợ khác")) {
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
      el.querySelector("#btn-confirm").textContent = "Đang chuyển hướng...";
    });

    await UI.addBotMessage(
      "Tôi đã chuẩn bị xong thông tin đặt chỗ. Bạn sẽ được chuyển đến trang thanh toán bảo mật của Vietnam Airlines để hoàn tất. Tôi không thực hiện thanh toán thay bạn. 🔒"
    );

    const banner = UI.createPaymentRedirectBanner(flight, totalPrice);
    await UI.addElement(banner, 400);
    ChatEngine.reset();
  }

  // ===== Upload button in input bar =====
  uploadTrigger.addEventListener("click", () => {
    const uploadArea = UI.createFileUpload(handleFileUpload);
    chatMessages.appendChild(uploadArea);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    ChatEngine.currentFlow = "CHECKIN";
    ChatEngine.flowState.waitingForPNR = true;
  });

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
