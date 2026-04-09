// ===================================================
// TICKETS PAGE CONTROLLER
// Full filtered ticket list + manual payment selection flow
// ===================================================

(function () {
  const BACKEND_BASE_URL = window.NEO_BACKEND_URL || "http://127.0.0.1:8000";

  const ticketsCountEl = document.getElementById("tickets-count");
  const ticketsListEl = document.getElementById("tickets-list");
  const ticketsEmptyEl = document.getElementById("tickets-empty");
  const filtersSummaryEl = document.getElementById("filters-summary");
  const selectedEmptyEl = document.getElementById("selected-empty");
  const selectedContentEl = document.getElementById("selected-content");
  const backBtn = document.getElementById("back-home-btn");

  let selectedCard = null;

  backBtn.addEventListener("click", () => {
    window.location.href = "index.html";
  });

  function parseOptionalInt(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }

  function formatPrice(price) {
    return new Intl.NumberFormat("vi-VN").format(Number(price || 0)) + " đ";
  }

  function classLabel(cls) {
    const key = (cls || "economy").toLowerCase();
    if (key === "business") return "Thương gia";
    if (key === "premium") return "Phổ thông đặc biệt";
    return "Phổ thông";
  }

  function classBadgeClass(cls) {
    const key = (cls || "economy").toLowerCase();
    return key;
  }

  function filterSummary(filters) {
    const pieces = [];
    if (filters.origin && filters.destination) {
      pieces.push(`Hành trình ${filters.origin} → ${filters.destination}`);
    }
    if (filters.date) {
      pieces.push(`Ngày ${filters.date}`);
    }
    if (filters.flight_class) {
      pieces.push(`Hạng ${classLabel(filters.flight_class)}`);
    }
    if (typeof filters.max_price === "number") {
      pieces.push(`Giá ≤ ${formatPrice(filters.max_price)}`);
    }
    if (typeof filters.min_departure_hour === "number" || typeof filters.max_departure_hour === "number") {
      const minText = typeof filters.min_departure_hour === "number" ? `${filters.min_departure_hour}:00` : "00:00";
      const maxText = typeof filters.max_departure_hour === "number" ? `${filters.max_departure_hour}:59` : "23:59";
      pieces.push(`Khung giờ ${minText} - ${maxText}`);
    }

    return pieces.length ? pieces.join(" · ") : "Bộ lọc cơ bản";
  }

  function createFlightCard(flight, onSelect) {
    const cls = (flight.cls || flight.class || "economy").toLowerCase();
    const card = document.createElement("div");
    card.className = `flight-card ${cls === "business" ? "business-card" : ""} ${cls === "premium" ? "premium-card" : ""}`;

    const dep = flight.dep || flight.departure || "--:--";
    const arr = flight.arr || flight.arrival || "--:--";

    card.innerHTML = `
      <div class="flight-card-header">
        <div class="airline-info">
          <span class="airline-logo">✈️</span>
          <div>
            <span class="airline-name">${flight.airline || "Unknown Airline"}</span>
            <span class="vna-badge">${flight.airline || "Airline"}</span>
          </div>
        </div>
        <div class="flight-class-badge ${classBadgeClass(cls)}">${classLabel(cls)}</div>
      </div>
      <div class="flight-times">
        <div class="time-block">
          <span class="time">${dep}</span>
          <span class="airport">${flight.origin || ""}</span>
        </div>
        <div class="flight-duration">
          <span class="duration-line"></span>
          <span class="duration-text">${flight.duration || "--"}</span>
          <span class="duration-line"></span>
        </div>
        <div class="time-block">
          <span class="time">${arr}</span>
          <span class="airport">${flight.destination || ""}</span>
        </div>
      </div>
      <div class="flight-footer">
        <div class="flight-meta">
          <span>✈ ${flight.fn || flight.flight_number}</span>
          <span>💺 ${flight.seats || flight.available_seats || 0} chỗ</span>
          <span>📅 ${flight.date || ""}</span>
        </div>
        <div class="flight-price-select">
          <span class="flight-price">${formatPrice(flight.price)}</span>
          <button class="select-flight-btn">Chọn</button>
        </div>
      </div>
    `;

    card.querySelector(".select-flight-btn").addEventListener("click", () => onSelect(flight, card));
    return card;
  }

  function renderSelectedFlight(flight, card) {
    if (selectedCard) selectedCard.classList.remove("selected");
    selectedCard = card;
    selectedCard.classList.add("selected");

    selectedEmptyEl.style.display = "none";
    selectedContentEl.style.display = "block";

    const dep = flight.dep || flight.departure || "--:--";
    const arr = flight.arr || flight.arrival || "--:--";

    selectedContentEl.innerHTML = `
      <div class="confirm-row">
        <span class="confirm-label">Chuyến bay</span>
        <span class="confirm-value flight-num">${flight.fn || flight.flight_number}</span>
      </div>
      <div class="confirm-row">
        <span class="confirm-label">Hành trình</span>
        <span class="confirm-value">${flight.origin} → ${flight.destination}</span>
      </div>
      <div class="confirm-row">
        <span class="confirm-label">Giờ bay</span>
        <span class="confirm-value">${dep} → ${arr}</span>
      </div>
      <div class="confirm-row">
        <span class="confirm-label">Hạng ghế</span>
        <span class="confirm-value">${classLabel(flight.cls || flight.class)}</span>
      </div>
      <div class="confirm-row">
        <span class="confirm-label">Giá từ</span>
        <span class="confirm-value">${formatPrice(flight.price)}</span>
      </div>
      <button class="ticket-manual-pay-btn" id="manual-pay-btn">Tiếp tục thanh toán thủ công</button>
    `;

    const manualBtn = document.getElementById("manual-pay-btn");
    manualBtn.addEventListener("click", () => {
      window.open("https://www.vietnamairlines.com/vn/vi/booking", "_blank", "noopener");
      alert("Bạn đã được mở trang đặt vé chính thức để tự chọn dịch vụ và thanh toán thủ công.");
    });
  }

  function renderFlights(flights) {
    ticketsListEl.innerHTML = "";

    if (!Array.isArray(flights) || flights.length === 0) {
      ticketsEmptyEl.style.display = "block";
      ticketsEmptyEl.textContent = "Không có chuyến phù hợp với bộ lọc hiện tại. Bạn có thể quay lại chat để nới lỏng điều kiện.";
      ticketsCountEl.textContent = "Không tìm thấy chuyến phù hợp";
      return;
    }

    ticketsEmptyEl.style.display = "none";
    ticketsCountEl.textContent = `Tìm thấy ${flights.length} chuyến phù hợp. Vui lòng chọn 1 chuyến để tiếp tục.`;

    flights.forEach((flight) => {
      const card = createFlightCard(flight, (picked, pickedCard) => renderSelectedFlight(picked, pickedCard));
      ticketsListEl.appendChild(card);
    });
  }

  async function loadFlights(filters) {
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/flights/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(filters)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      renderFlights(data.flights || []);
    } catch (error) {
      console.error("Cannot load flights:", error);
      ticketsCountEl.textContent = "Không tải được dữ liệu từ backend.";
      ticketsEmptyEl.style.display = "block";
      ticketsEmptyEl.textContent = "Vui lòng kiểm tra backend đang chạy tại cổng 8000 rồi tải lại trang.";
    }
  }

  const qs = new URLSearchParams(window.location.search);
  const filters = {
    origin: qs.get("origin") || "",
    destination: qs.get("destination") || "",
    date: qs.get("date") || null,
    max_price: parseOptionalInt(qs.get("max_price")),
    flight_class: qs.get("flight_class") || null,
    min_departure_hour: parseOptionalInt(qs.get("min_departure_hour")),
    max_departure_hour: parseOptionalInt(qs.get("max_departure_hour")),
    limit: 200
  };

  filtersSummaryEl.textContent = filterSummary(filters);

  if (!filters.origin || !filters.destination) {
    ticketsCountEl.textContent = "Thiếu thông tin hành trình.";
    ticketsEmptyEl.style.display = "block";
    ticketsEmptyEl.textContent = "Vui lòng quay lại chat và tìm chuyến bay trước, sau đó chọn nút \"Có\" để mở trang danh sách vé.";
    return;
  }

  loadFlights(filters);
})();
