// ===================================================
// CHECK-IN PAGE CONTROLLER
// Visual seat selection (6 seats/row: A-B-C | D-E-F)
// ===================================================

(function () {
  const BACKEND_BASE_URL = window.NEO_BACKEND_URL || "http://127.0.0.1:8000";
  const LEFT_COLUMNS = ["A", "B", "C"];
  const RIGHT_COLUMNS = ["D", "E", "F"];
  const FEEDBACK_LOW_RATING_SET = new Set(["chua_tot", "te"]);
  const STORAGE_KEYS = {
    backendSessionId: "neo_backend_session_id_v1",
    currentUserId: "neo_current_user_id_v1",
  };

  const backBtn = document.getElementById("checkin-back-btn");
  const form = document.getElementById("checkin-form");
  const pnrInput = document.getElementById("pnr-input");
  const surnameInput = document.getElementById("surname-input");
  const alertEl = document.getElementById("checkin-alert");
  const resultEl = document.getElementById("checkin-result");
  const feedbackSlotEl = document.getElementById("service-feedback-slot");

  const seatmapEmptyEl = document.getElementById("seatmap-empty");
  const seatmapContentEl = document.getElementById("seatmap-content");
  const seatmapSummaryEl = document.getElementById("seatmap-summary");
  const seatmapGridEl = document.getElementById("seatmap-grid");
  const selectedBoxEl = document.getElementById("seatmap-selected-box");
  const confirmSeatBtn = document.getElementById("confirm-seat-btn");

  const state = {
    payload: null,
    selectedSeatNo: null,
    feedbackShown: false,
  };

  backBtn.addEventListener("click", () => {
    window.location.href = "index.html";
  });

  pnrInput.addEventListener("blur", () => {
    pnrInput.value = normalizePNR(pnrInput.value);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await loadSeatmap();
  });

  confirmSeatBtn.addEventListener("click", async () => {
    if (!state.payload || !state.selectedSeatNo) return;

    const originalText = confirmSeatBtn.textContent;
    confirmSeatBtn.textContent = "Đang xác nhận check-in...";
    confirmSeatBtn.disabled = true;

    try {
      const resp = await fetch(`${BACKEND_BASE_URL}/api/checkin/select-seat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pnr_code: state.payload.pnr,
          seat_no: state.selectedSeatNo,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data?.ok) {
        setAlert("error", data?.message || "Không thể xác nhận check-in ở thời điểm hiện tại.");
        resultEl.style.display = "none";
        return;
      }

      setAlert("success", "Check-in thành công. Bạn có thể mang mã này ra sân bay để hoàn tất thủ tục.");
      resultEl.style.display = "block";
      resultEl.textContent = data.message || "Check-in thành công.";
      showFeedbackSurvey({
        triggerEvent: "checkin_success",
        metadata: {
          pnr: state.payload?.pnr || null,
          selected_seat: state.selectedSeatNo || null,
          flight_number: state.payload?.flight_number || null,
        },
      });
    } catch (error) {
      console.error("Cannot confirm seat selection:", error);
      setAlert("error", "Không thể kết nối backend để xác nhận ghế.");
      resultEl.style.display = "none";
    } finally {
      confirmSeatBtn.textContent = originalText;
      updateSelectedBox();
      confirmSeatBtn.disabled = !state.payload?.checkin_success || !state.selectedSeatNo;
    }
  });

  function normalizePNR(value) {
    return String(value || "").trim().toUpperCase();
  }

  function setAlert(type, message) {
    alertEl.className = `checkin-alert ${type}`;
    alertEl.textContent = message;
  }

  function classLabel(value) {
    const token = String(value || "").toLowerCase();
    if (token === "business") return "Thương gia";
    if (token === "premium") return "Phổ thông đặc biệt";
    return "Phổ thông";
  }

  function formatPrice(price) {
    return new Intl.NumberFormat("vi-VN").format(Number(price || 0)) + " VND";
  }

  function seatSortKey(a, b) {
    if (Number(a.row) !== Number(b.row)) return Number(a.row) - Number(b.row);
    return String(a.column).localeCompare(String(b.column));
  }

  async function loadSeatmap() {
    const pnr = normalizePNR(pnrInput.value);
    if (!pnr) {
      setAlert("error", "Vui lòng nhập mã PNR trước khi tra cứu.");
      return;
    }

    pnrInput.value = pnr;
    resultEl.style.display = "none";
    clearFeedbackSurvey();
    setAlert("info", "Đang tra cứu dữ liệu ghế từ dataset mock_data...");

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/checkin/seatmap`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pnr_code: pnr }),
      });

      const data = await response.json();
      if (!response.ok || !data?.found) {
        state.payload = null;
        state.selectedSeatNo = null;
        seatmapContentEl.style.display = "none";
        seatmapEmptyEl.style.display = "block";
        setAlert("error", data?.message || "Không tìm thấy PNR trong dữ liệu hiện tại.");
        return;
      }

      state.payload = data;
      state.selectedSeatNo = null;

      seatmapEmptyEl.style.display = "none";
      seatmapContentEl.style.display = "block";

      const surname = String(surnameInput.value || "").trim();
      if (surname) {
        setAlert(
          data.checkin_success ? "info" : "error",
          `${data.message} · Họ hành khách xác nhận: ${surname}`
        );
      } else {
        setAlert(data.checkin_success ? "info" : "error", data.message);
      }

      renderSummary(data);
      renderSeatmapGrid(data);

      const firstSelectable = Array.isArray(data.seatmap)
        ? data.seatmap.find((seat) => seat.is_selectable)
        : null;
      if (data.checkin_success && firstSelectable) {
        state.selectedSeatNo = firstSelectable.seat_no;
      }

      updateSelectedBox();
      renderSeatmapGrid(data);
      confirmSeatBtn.disabled = !data.checkin_success || !state.selectedSeatNo;
    } catch (error) {
      console.error("Cannot load check-in seatmap:", error);
      state.payload = null;
      state.selectedSeatNo = null;
      seatmapContentEl.style.display = "none";
      seatmapEmptyEl.style.display = "block";
      setAlert("error", "Không kết nối được backend. Hãy đảm bảo API đang chạy cổng 8000.");
    }
  }

  function renderSummary(payload) {
    const rows = [
      ["PNR", payload.pnr],
      ["Chuyến bay", payload.flight_number || "--"],
      ["Hành trình", `${payload.origin || "--"} → ${payload.destination || "--"}`],
      ["Ngày/giờ", `${payload.date || "--"} · ${payload.departure || "--:--"} → ${payload.arrival || "--:--"}`],
      ["Hạng ghế", classLabel(payload.booking_class || "economy")],
      ["Nguồn dữ liệu", payload.data_source || payload.source_file || "mock_data/vna_master_seatmap.csv"],
    ];

    seatmapSummaryEl.innerHTML = rows
      .map(
        ([label, value]) => `
          <div class="seatmap-summary-item">
            <span>${label}</span>
            <strong>${value}</strong>
          </div>
        `
      )
      .join("");
  }

  function getSeatClass(item) {
    if (!item) return "seat-btn blocked";

    if (item.seat_no === state.selectedSeatNo) {
      return "seat-btn selectable selected";
    }

    if (item.is_user_seat && item.status !== "available") {
      return "seat-btn current";
    }

    if (item.is_selectable) {
      return "seat-btn selectable";
    }

    if (item.status === "occupied") {
      return "seat-btn occupied";
    }

    if (item.status === "available") {
      return "seat-btn blocked";
    }

    return "seat-btn blocked";
  }

  function createSeatButton(rowNum, column, item) {
    const seatBtn = document.createElement("button");
    seatBtn.type = "button";

    if (!item) {
      seatBtn.className = "seat-btn blocked";
      seatBtn.textContent = `${rowNum}${column}`;
      seatBtn.disabled = true;
      return seatBtn;
    }

    seatBtn.className = getSeatClass(item);
    seatBtn.textContent = item.seat_no;
    seatBtn.title = `${item.seat_no} · ${item.attribute || "-"} · ${formatPrice(item.price)} · status=${item.status}`;

    if (item.is_selectable) {
      seatBtn.addEventListener("click", () => {
        state.selectedSeatNo = item.seat_no;
        renderSeatmapGrid(state.payload);
        updateSelectedBox();
        confirmSeatBtn.disabled = false;
      });
    } else {
      seatBtn.disabled = true;
    }

    return seatBtn;
  }

  function renderSeatmapGrid(payload) {
    const seats = Array.isArray(payload.seatmap) ? [...payload.seatmap] : [];
    seats.sort(seatSortKey);

    const byRow = new Map();
    seats.forEach((seat) => {
      const rowNumber = Number(seat.row);
      if (!byRow.has(rowNumber)) {
        byRow.set(rowNumber, {});
      }
      byRow.get(rowNumber)[String(seat.column).toUpperCase()] = seat;
    });

    const rowNumbers = Array.from(byRow.keys()).sort((a, b) => a - b);
    seatmapGridEl.innerHTML = "";

    rowNumbers.forEach((rowNum) => {
      const rowData = byRow.get(rowNum) || {};
      const rowEl = document.createElement("div");
      rowEl.className = "seat-row";

      const rowNumberEl = document.createElement("div");
      rowNumberEl.className = "seat-row-number";
      rowNumberEl.textContent = String(rowNum);
      rowEl.appendChild(rowNumberEl);

      LEFT_COLUMNS.forEach((column) => {
        rowEl.appendChild(createSeatButton(rowNum, column, rowData[column]));
      });

      const aisleEl = document.createElement("div");
      aisleEl.className = "seat-aisle";
      aisleEl.textContent = "|";
      rowEl.appendChild(aisleEl);

      RIGHT_COLUMNS.forEach((column) => {
        rowEl.appendChild(createSeatButton(rowNum, column, rowData[column]));
      });

      seatmapGridEl.appendChild(rowEl);
    });
  }

  function updateSelectedBox() {
    if (!state.payload) {
      selectedBoxEl.textContent = "Bạn chưa chọn ghế check-in.";
      return;
    }

    if (!state.payload.checkin_success) {
      selectedBoxEl.textContent = "PNR hợp lệ nhưng không còn ghế trống để check-in trong dataset hiện tại.";
      confirmSeatBtn.disabled = true;
      return;
    }

    if (!state.selectedSeatNo) {
      selectedBoxEl.textContent = "Vui lòng chọn một ghế màu xanh để tiếp tục check-in.";
      confirmSeatBtn.disabled = true;
      return;
    }

    const selected = (state.payload.seatmap || []).find((seat) => seat.seat_no === state.selectedSeatNo);
    selectedBoxEl.textContent = selected
      ? `Ghế đã chọn: ${selected.seat_no} · ${selected.attribute || "-"} · Giá ${formatPrice(selected.price)}.`
      : `Ghế đã chọn: ${state.selectedSeatNo}.`;
  }

  function clearFeedbackSurvey() {
    state.feedbackShown = false;
    if (!feedbackSlotEl) return;
    feedbackSlotEl.innerHTML = "";
    feedbackSlotEl.style.display = "none";
  }

  function showFeedbackSurvey({ triggerEvent, metadata }) {
    if (!feedbackSlotEl || state.feedbackShown) return;
    state.feedbackShown = true;

    feedbackSlotEl.innerHTML = `
      <div class="service-feedback-card">
        <div class="service-feedback-title">📝 Đánh giá dịch vụ check-in</div>
        <p class="service-feedback-desc">Bạn hài lòng với trải nghiệm check-in vừa rồi chứ?</p>
        <div class="feedback-rating-grid">
          <button class="feedback-rating-btn" data-rating="tot">Tốt</button>
          <button class="feedback-rating-btn" data-rating="on">Ổn</button>
          <button class="feedback-rating-btn" data-rating="chua_tot">Chưa tốt</button>
          <button class="feedback-rating-btn" data-rating="te">Tệ</button>
        </div>
        <div class="feedback-improvement-box" style="display:none;">
          <label>Bạn muốn chúng tôi cải thiện điều gì?</label>
          <textarea class="feedback-note-input" rows="3" placeholder="Mời bạn góp ý để đội ngũ cải thiện dịch vụ..."></textarea>
        </div>
        <div class="feedback-actions-row">
          <button class="feedback-submit-btn" disabled>Gửi đánh giá</button>
        </div>
        <div class="feedback-status" aria-live="polite"></div>
      </div>
    `;
    feedbackSlotEl.style.display = "block";

    const card = feedbackSlotEl.querySelector(".service-feedback-card");
    const ratingButtons = Array.from(card.querySelectorAll(".feedback-rating-btn"));
    const improvementBox = card.querySelector(".feedback-improvement-box");
    const noteInput = card.querySelector(".feedback-note-input");
    const submitBtn = card.querySelector(".feedback-submit-btn");
    const statusEl = card.querySelector(".feedback-status");

    let selectedRating = "";

    const updateSubmitState = () => {
      const needNote = FEEDBACK_LOW_RATING_SET.has(selectedRating);
      const note = (noteInput?.value || "").trim();
      submitBtn.disabled = !selectedRating || (needNote && !note);
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

      const note = (noteInput?.value || "").trim();
      if (FEEDBACK_LOW_RATING_SET.has(selectedRating) && !note) {
        statusEl.textContent = "Vui lòng nhập góp ý cải thiện cho mức đánh giá này.";
        statusEl.classList.add("error");
        return;
      }

      submitBtn.disabled = true;
      statusEl.textContent = "Đang lưu đánh giá...";
      statusEl.classList.remove("error", "success");

      try {
        const resp = await fetch(`${BACKEND_BASE_URL}/api/feedback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rating: selectedRating,
            trigger_event: triggerEvent,
            session_id: localStorage.getItem(STORAGE_KEYS.backendSessionId) || null,
            user_id: localStorage.getItem(STORAGE_KEYS.currentUserId) || null,
            improvement_note: note || null,
            metadata: metadata || {},
          }),
        });

        const data = await resp.json();
        if (!resp.ok || !data?.ok) {
          throw new Error(data?.detail || "Không thể lưu đánh giá.");
        }

        statusEl.textContent = "✅ Cảm ơn bạn! Đánh giá đã được lưu.";
        statusEl.classList.add("success");
        ratingButtons.forEach((btn) => {
          btn.disabled = true;
        });
        if (noteInput) noteInput.disabled = true;
      } catch (error) {
        console.error("Cannot submit check-in feedback:", error);
        statusEl.textContent = "⚠️ Lưu đánh giá thất bại, vui lòng thử lại.";
        statusEl.classList.add("error");
        submitBtn.disabled = false;
      }
    });
  }

  const pnrFromQuery = normalizePNR(new URLSearchParams(window.location.search).get("pnr") || "");
  if (pnrFromQuery) {
    pnrInput.value = pnrFromQuery;
    loadSeatmap();
  }
})();
