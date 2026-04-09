// ===================================================
// TICKETS PAGE CONTROLLER
// VNA-style grouped fare cards + dataset-backed rendering
// ===================================================

(function () {
  const BACKEND_BASE_URL = window.NEO_BACKEND_URL || "http://127.0.0.1:8000";
  const SEAT_CLASS_ORDER = ["economy", "premium", "business"];

  const ticketsCountEl = document.getElementById("tickets-count");
  const ticketsListEl = document.getElementById("tickets-list");
  const ticketsEmptyEl = document.getElementById("tickets-empty");
  const filtersSummaryEl = document.getElementById("filters-summary");
  const filtersPanelContentEl = document.getElementById("filters-panel-content");
  const filtersPanelEl = document.getElementById("filters-panel");
  const selectedEmptyEl = document.getElementById("selected-empty");
  const selectedContentEl = document.getElementById("selected-content");
  const dataSourceEl = document.getElementById("ticket-datasource");
  const backBtn = document.getElementById("back-home-btn");
  const sortSelect = document.getElementById("sort-select");
  const toggleFiltersBtn = document.getElementById("toggle-filters-btn");
  const sortChips = Array.from(document.querySelectorAll(".sort-chip"));

  let groupedFlights = [];
  let selectedFare = null;
  let activeSort = "default";

  const qs = new URLSearchParams(window.location.search);
  const preferredFlight = (qs.get("selected_flight") || "").trim().toUpperCase();
  const preferredClass = normalizeClass(qs.get("selected_class") || qs.get("flight_class") || "") || null;

  backBtn.addEventListener("click", () => {
    window.location.href = "index.html";
  });

  toggleFiltersBtn.addEventListener("click", () => {
    const hidden = filtersPanelEl.style.display === "none";
    filtersPanelEl.style.display = hidden ? "block" : "none";
    toggleFiltersBtn.textContent = hidden ? "✕ ẨN BỘ LỌC" : "⚙ HIỂN THỊ BỘ LỌC";
  });

  sortSelect.addEventListener("change", () => applySort(sortSelect.value));
  sortChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const sort = chip.dataset.sort || "default";
      applySort(sort);
    });
  });

  function parseOptionalInt(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }

  function formatPrice(price) {
    return new Intl.NumberFormat("vi-VN").format(Number(price || 0)) + " VND";
  }

  function classLabel(cls) {
    const key = normalizeClass(cls);
    if (key === "business") return "Thương gia";
    if (key === "premium") return "Phổ thông đặc biệt";
    return "Phổ thông";
  }

  function normalizeClass(value) {
    const token = (value || "").toLowerCase().trim();
    if (["premium", "premium_economy", "premium economy"].includes(token)) return "premium";
    if (["business", "thuong gia"].includes(token)) return "business";
    if (["economy", "pho thong"].includes(token)) return "economy";
    return token;
  }

  function toMinutes(time) {
    const [h, m] = String(time || "0:0").split(":").map((item) => Number(item) || 0);
    return h * 60 + m;
  }

  function durationToMinutes(text) {
    const token = String(text || "");
    const match = token.match(/(\d+)h\s*(\d+)?m?/i);
    if (match) {
      const h = Number(match[1]) || 0;
      const m = Number(match[2]) || 0;
      return h * 60 + m;
    }

    const fallback = token.match(/(\d+)h/i);
    return fallback ? (Number(fallback[1]) || 0) * 60 : 9999;
  }

  function formatDate(dateStr) {
    if (!dateStr) return "--";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    const weekday = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][date.getDay()];
    return `${weekday}, ${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
  }

  function filterSummary(filters) {
    const pieces = [];
    if (filters.origin && filters.destination) {
      pieces.push(`Hành trình ${filters.origin} → ${filters.destination}`);
    }
    if (filters.date) {
      pieces.push(`Ngày bay ${formatDate(filters.date)}`);
    }
    if (typeof filters.max_price === "number") {
      pieces.push(`Giá tối đa ${formatPrice(filters.max_price)}`);
    }
    if (typeof filters.min_departure_hour === "number" || typeof filters.max_departure_hour === "number") {
      const minText = typeof filters.min_departure_hour === "number" ? `${String(filters.min_departure_hour).padStart(2, "0")}:00` : "00:00";
      const maxText = typeof filters.max_departure_hour === "number" ? `${String(filters.max_departure_hour).padStart(2, "0")}:59` : "23:59";
      pieces.push(`Khung giờ ${minText} - ${maxText}`);
    }
    if (filters.flight_class) {
      pieces.push(`Ưu tiên hạng ${classLabel(filters.flight_class)}`);
    }

    return pieces.length ? pieces.join(" · ") : "Bộ lọc cơ bản";
  }

  function renderFiltersPanel(filters) {
    const rows = [
      ["Điểm đi", filters.origin || "--"],
      ["Điểm đến", filters.destination || "--"],
      ["Ngày bay", filters.date ? formatDate(filters.date) : "Linh hoạt"],
      ["Giá tối đa", typeof filters.max_price === "number" ? formatPrice(filters.max_price) : "Không giới hạn"],
      ["Khung giờ", `${typeof filters.min_departure_hour === "number" ? `${filters.min_departure_hour}:00` : "00:00"} - ${typeof filters.max_departure_hour === "number" ? `${filters.max_departure_hour}:59` : "23:59"}`],
      ["Hạng ghế", filters.flight_class ? classLabel(filters.flight_class) : "Tất cả hạng"],
    ];

    filtersPanelContentEl.innerHTML = rows
      .map(
        ([label, value]) => `
          <div class="tickets-filter-item">
            <span>${label}</span>
            <strong>${value}</strong>
          </div>
        `
      )
      .join("");
  }

  function groupFlightsBySegment(flights) {
    const groupsByKey = new Map();

    flights.forEach((flight) => {
      const fn = String(flight.fn || flight.flight_number || "").toUpperCase();
      const origin = String(flight.origin || "");
      const destination = String(flight.destination || "");
      const date = String(flight.date || "");
      const dep = String(flight.dep || flight.departure || "--:--");
      const arr = String(flight.arr || flight.arrival || "--:--");
      const cls = normalizeClass(flight.cls || flight.class || "economy") || "economy";

      const key = [fn, origin, destination, date, dep, arr].join("|");
      if (!groupsByKey.has(key)) {
        groupsByKey.set(key, {
          key,
          fn,
          airline: flight.airline || "Vietnam Airlines",
          origin,
          destination,
          date,
          dep,
          arr,
          duration: flight.duration || "--",
          fares: {
            economy: null,
            premium: null,
            business: null,
          },
        });
      }

      const group = groupsByKey.get(key);
      const fareInfo = {
        cls,
        price: Number(flight.price || 0),
        seats: Number(flight.seats || flight.available_seats || 0),
      };
      group.fares[cls] = fareInfo;
    });

    return Array.from(groupsByKey.values()).map((group) => {
      const availablePrices = Object.values(group.fares)
        .filter(Boolean)
        .map((item) => Number(item.price || 0));
      group.minPrice = availablePrices.length ? Math.min(...availablePrices) : Number.MAX_SAFE_INTEGER;
      group.depMinutes = toMinutes(group.dep);
      group.durationMinutes = durationToMinutes(group.duration);
      return group;
    });
  }

  function sortGroupedFlights(groups, sortMode) {
    const clone = [...groups];
    if (sortMode === "cheapest") {
      clone.sort((a, b) => a.minPrice - b.minPrice || a.depMinutes - b.depMinutes);
      return clone;
    }
    if (sortMode === "earliest") {
      clone.sort((a, b) => a.depMinutes - b.depMinutes || a.minPrice - b.minPrice);
      return clone;
    }
    if (sortMode === "shortest") {
      const underTwoHours = clone.filter((item) => item.durationMinutes <= 120);
      underTwoHours.sort((a, b) => a.durationMinutes - b.durationMinutes || a.minPrice - b.minPrice);
      return underTwoHours.length ? underTwoHours : clone.sort((a, b) => a.durationMinutes - b.durationMinutes || a.minPrice - b.minPrice);
    }

    clone.sort((a, b) => a.depMinutes - b.depMinutes || a.minPrice - b.minPrice);
    return clone;
  }

  function markActiveSortUI(sortMode) {
    sortSelect.value = sortMode;
    sortChips.forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.sort === sortMode);
    });
  }

  function applySort(sortMode) {
    activeSort = sortMode;
    markActiveSortUI(sortMode);
    renderGroupedFlights();
  }

  function createFareColumn(group, cls) {
    const fare = group.fares[cls];
    const isSelected =
      selectedFare &&
      selectedFare.groupKey === group.key &&
      selectedFare.cls === cls;

    if (!fare) {
      return `
        <button class="ticket-fare-col disabled" disabled>
          <span class="ticket-fare-class">${classLabel(cls)}</span>
          <span class="ticket-fare-price">--</span>
          <span class="ticket-fare-note">Hết ghế</span>
        </button>
      `;
    }

    return `
      <button class="ticket-fare-col ${cls} ${isSelected ? "selected" : ""}" data-group="${group.key}" data-class="${cls}">
        <span class="ticket-fare-class">${classLabel(cls)}</span>
        <span class="ticket-fare-price">${formatPrice(fare.price)}</span>
        <span class="ticket-fare-note">${fare.seats} ghế còn lại</span>
      </button>
    `;
  }

  function renderGroupedFlights() {
    ticketsListEl.innerHTML = "";
    ticketsEmptyEl.style.display = "none";

    const visibleGroups = sortGroupedFlights(groupedFlights, activeSort);
    if (!visibleGroups.length) {
      ticketsCountEl.textContent = "Không có chuyến phù hợp với bộ lọc hiện tại.";
      ticketsEmptyEl.style.display = "block";
      ticketsEmptyEl.textContent = "Bạn có thể quay lại chat để điều chỉnh bộ lọc hoặc chọn ngày khác.";
      return;
    }

    ticketsCountEl.textContent = `Tìm thấy ${visibleGroups.length} lựa chọn chuyến bay. Hãy chọn hạng ghế ở cột bên phải mỗi chuyến.`;

    const cardsHtml = visibleGroups
      .map(
        (group) => `
          <article class="ticket-vna-card" data-group="${group.key}">
            <div class="ticket-vna-main">
              <div class="ticket-vna-times">
                <div>
                  <div class="ticket-vna-time">${group.dep}</div>
                  <div class="ticket-vna-airport">${group.origin}</div>
                </div>
                <div class="ticket-vna-flightline">
                  <span>Bay thẳng</span>
                  <div class="ticket-line"></div>
                  <small>${group.duration}</small>
                </div>
                <div>
                  <div class="ticket-vna-time">${group.arr}</div>
                  <div class="ticket-vna-airport">${group.destination}</div>
                </div>
              </div>

              <div class="ticket-vna-meta">
                <div>✈ ${group.fn} · ${group.airline}</div>
                <div>📅 ${formatDate(group.date)}</div>
              </div>
            </div>

            <div class="ticket-fare-grid">
              ${SEAT_CLASS_ORDER.map((cls) => createFareColumn(group, cls)).join("")}
            </div>
          </article>
        `
      )
      .join("");

    ticketsListEl.innerHTML = cardsHtml;

    ticketsListEl.querySelectorAll(".ticket-fare-col:not(.disabled)").forEach((button) => {
      button.addEventListener("click", () => {
        const groupKey = button.dataset.group;
        const cls = button.dataset.class;
        const group = groupedFlights.find((item) => item.key === groupKey);
        if (!group || !group.fares[cls]) return;
        selectedFare = {
          groupKey,
          cls,
          group,
          fare: group.fares[cls],
        };
        renderSelectedFare();
        renderGroupedFlights();
      });
    });
  }

  function renderSelectedFare() {
    if (!selectedFare) {
      selectedEmptyEl.style.display = "block";
      selectedContentEl.style.display = "none";
      return;
    }

    selectedEmptyEl.style.display = "none";
    selectedContentEl.style.display = "block";

    const { group, fare, cls } = selectedFare;
    selectedContentEl.innerHTML = `
      <div class="confirm-row">
        <span class="confirm-label">Chuyến bay</span>
        <span class="confirm-value flight-num">${group.fn}</span>
      </div>
      <div class="confirm-row">
        <span class="confirm-label">Hành trình</span>
        <span class="confirm-value">${group.origin} → ${group.destination}</span>
      </div>
      <div class="confirm-row">
        <span class="confirm-label">Ngày/Giờ</span>
        <span class="confirm-value">${formatDate(group.date)} · ${group.dep} → ${group.arr}</span>
      </div>
      <div class="confirm-row">
        <span class="confirm-label">Hạng ghế</span>
        <span class="confirm-value">${classLabel(cls)}</span>
      </div>
      <div class="confirm-row">
        <span class="confirm-label">Giá vé</span>
        <span class="confirm-value">${formatPrice(fare.price)}</span>
      </div>
      <div class="confirm-row">
        <span class="confirm-label">Ghế còn lại</span>
        <span class="confirm-value">${fare.seats}</span>
      </div>

      <button class="ticket-manual-pay-btn" id="manual-pay-btn">Tiếp tục thanh toán thủ công</button>
      <button class="ticket-checkin-btn" id="ticket-back-chat-btn">Quay lại chat để nhận hỗ trợ thêm</button>
    `;

    const manualBtn = document.getElementById("manual-pay-btn");
    manualBtn.addEventListener("click", () => {
      window.open("https://www.vietnamairlines.com/vn/vi/booking", "_blank", "noopener");
      alert("Đã mở trang đặt vé chính thức của Vietnam Airlines để bạn tự thanh toán.");
    });

    const backChatBtn = document.getElementById("ticket-back-chat-btn");
    backChatBtn.addEventListener("click", () => {
      const params = new URLSearchParams({
        from: group.origin,
        to: group.destination,
        flight: group.fn,
        cls,
        date: group.date,
      });
      window.location.href = `index.html?${params.toString()}`;
    });
  }

  async function loadFlights(filters) {
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/flights/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...filters,
          flight_class: null,
          limit: 500,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      dataSourceEl.textContent = `Nguồn dữ liệu: ${data?.data_source || "mock_data/vna_master_seatmap.csv"}`;

      groupedFlights = groupFlightsBySegment(data?.flights || []);

      if (preferredFlight) {
        const group = groupedFlights.find((item) => item.fn === preferredFlight);
        if (group) {
          const cls = preferredClass && group.fares[preferredClass] ? preferredClass : SEAT_CLASS_ORDER.find((key) => group.fares[key]);
          if (cls) {
            selectedFare = {
              groupKey: group.key,
              cls,
              group,
              fare: group.fares[cls],
            };
          }
        }
      }

      renderSelectedFare();
      renderGroupedFlights();
    } catch (error) {
      console.error("Cannot load flights:", error);
      ticketsCountEl.textContent = "Không tải được dữ liệu từ backend.";
      ticketsEmptyEl.style.display = "block";
      ticketsEmptyEl.textContent = "Vui lòng kiểm tra backend đang chạy tại cổng 8000 rồi tải lại trang.";
      dataSourceEl.textContent = "Nguồn dữ liệu: chưa khả dụng";
    }
  }

  const filters = {
    origin: qs.get("origin") || "",
    destination: qs.get("destination") || "",
    date: qs.get("date") || null,
    max_price: parseOptionalInt(qs.get("max_price")),
    flight_class: normalizeClass(qs.get("flight_class") || "") || null,
    min_departure_hour: parseOptionalInt(qs.get("min_departure_hour")),
    max_departure_hour: parseOptionalInt(qs.get("max_departure_hour")),
  };

  filtersSummaryEl.textContent = filterSummary(filters);
  renderFiltersPanel(filters);
  applySort("default");

  if (!filters.origin || !filters.destination) {
    ticketsCountEl.textContent = "Thiếu thông tin hành trình.";
    ticketsEmptyEl.style.display = "block";
    ticketsEmptyEl.textContent = "Vui lòng quay lại chat và xác nhận đúng thông tin hành trình để mở trang chọn vé.";
    dataSourceEl.textContent = "Nguồn dữ liệu: chưa khả dụng";
    return;
  }

  loadFlights(filters);
})();
