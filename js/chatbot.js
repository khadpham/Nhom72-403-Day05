// ===================================================
// CHATBOT FLOW ENGINE - State Machine
// Routes user messages to appropriate flows
// ===================================================

const ChatEngine = {
  currentFlow: null,
  flowState: {},
  conflictCount: 0,
  currentUser: null,

  // ===== Intent Detection =====
  detectIntent(text) {
    const t = text.toLowerCase();

    // UC-04 Check-in flow
    if (/(check.?in|làm thủ tục|mã pnr|boarding|lên máy bay)/i.test(t)) return "CHECKIN";

    // UC-03 Group/Complex booking
    if (/(người cao tuổi|bà cụ|ông cụ|trẻ em|em bé|trẻ nhỏ|infant|senior|gia đình|cả nhà|bé \d|xe lăn|nôi|bassinet)/i.test(t)) return "GROUP_SEARCH";

    // UC-02 Multi-field search
    if (/(vé|bay|chuyến|tìm|đặt|giá|phú quốc|đà nẵng|hà nội|hồ chí minh|seoul|singapore|tokyo|bangkok)/i.test(t)) return "SEARCH";

    // Confirm / Yes / No
    if (/^(có|ừ|ok|đúng|xác nhận|đồng ý|chuẩn|được|vâng|yes)/i.test(t)) return "CONFIRM";
    if (/^(không|thôi|hủy|bỏ|cancel|no)/i.test(t)) return "CANCEL";

    // Transfer to agent
    if (/(nhân viên|tổng đài|người thật|hỗ trợ trực tiếp)/i.test(t)) return "ESCALATE";

    return "UNKNOWN";
  },

  // ===== Parameter Extraction =====
  extractParams(text) {
    const params = {};
    const t = text.toLowerCase();

    // Destinations
    const destinations = ["đà nẵng", "phú quốc", "hồ chí minh", "hà nội", "seoul", "singapore", "tokyo", "bangkok", "hong kong"];
    const originKeywords = { "đà nẵng": "Đà Nẵng", "phú quốc": "Phú Quốc", "hồ chí minh": "Hồ Chí Minh", "hà nội": "Hà Nội", "seoul": "Seoul", "singapore": "Singapore", "tokyo": "Tokyo", "bangkok": "Bangkok", "hong kong": "Hong Kong" };
    const found = destinations.filter(d => t.includes(d));
    if (found.length >= 2) {
      params.origin = originKeywords[found[0]];
      params.destination = originKeywords[found[1]];
    } else if (found.length === 1) {
      params.destination = originKeywords[found[0]];
    }

    // Origin keywords
    if (/từ hà nội|ở hà nội/.test(t)) params.origin = "Hà Nội";
    if (/từ hồ chí minh|ở hồ chí minh|từ sài gòn|từ sgn/.test(t)) params.origin = "Hồ Chí Minh";

    // Class
    if (/thương gia|business|hạng c/.test(t)) params.class = "business";
    else if (/phổ thông đặc biệt|premium economy|premium/.test(t)) params.class = "premium";
    else if (/phổ thông|economy|hạng y/.test(t)) params.class = "economy";

    // Price
    const priceMatch = t.match(/dưới\s*([\d,\.]+)\s*(triệu|tr|k|nghìn|đ)?/);
    if (priceMatch) {
      let price = parseFloat(priceMatch[1].replace(",", "."));
      if (priceMatch[2]?.includes("triệu") || priceMatch[2]?.includes("tr")) price *= 1000000;
      else if (priceMatch[2]?.includes("k") || priceMatch[2]?.includes("nghìn")) price *= 1000;
      params.maxPrice = price;
    }

    // Time of day
    if (/buổi sáng|sáng sớm|trước 12/.test(t)) { params.minDep = 5; params.maxDep = 12; }
    if (/buổi trưa|11h|12h|trưa/.test(t)) { params.minDep = 10; params.maxDep = 14; }
    if (/buổi chiều|chiều/.test(t)) { params.minDep = 12; params.maxDep = 18; }
    if (/buổi tối|tối|evening/.test(t)) { params.minDep = 18; params.maxDep = 24; }
    if (/sau (\d+)h|sau (\d+) giờ/.test(t)) {
      const m = t.match(/sau (\d+)[h\s]?/);
      if (m) params.minDep = parseInt(m[1]);
    }

    // Date - map weekday mentions to upcoming dates
    const dateMap = this.getUpcomingDates();
    if (/thứ hai|monday/.test(t)) params.date = dateMap[1];
    if (/thứ ba|tuesday/.test(t)) params.date = dateMap[2];
    if (/thứ tư|wednesday/.test(t)) params.date = dateMap[3];
    if (/thứ năm|thursday/.test(t)) params.date = dateMap[4];
    if (/thứ sáu|friday/.test(t)) params.date = dateMap[5];
    if (/thứ bảy|saturday/.test(t)) params.date = dateMap[6];
    if (/chủ nhật|sunday/.test(t)) params.date = dateMap[0];

    // Specific dates like "ngày 15", "ngày 17"
    const dateNumMatch = t.match(/ngày (\d{1,2})/);
    if (dateNumMatch) {
      const day = parseInt(dateNumMatch[1]);
      const now = new Date();
      const targetDate = new Date(now.getFullYear(), now.getMonth(), day);
      if (targetDate < now) targetDate.setMonth(targetDate.getMonth() + 1);
      params.date = targetDate.toISOString().split("T")[0];
    }

    // Passenger counts
    const adultMatch = t.match(/(\d+)\s*(người lớn|adult|nguoi lon)/);
    if (adultMatch) params.adults = parseInt(adultMatch[1]);
    const childMatch = t.match(/(\d+)\s*(trẻ em|bé|bạn nhỏ|em bé|child)/);
    if (childMatch) params.children = parseInt(childMatch[1]);
    const infantMatch = t.match(/(\d+[\.,]?\d*)\s*(tuổi rưỡi|tuổi)\s*(?=.*bé|.*infant)/);
    if (infantMatch && parseFloat(infantMatch[1]) < 2) params.infants = 1;

    return params;
  },

  getUpcomingDates() {
    const dates = {};
    const today = new Date();
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates[d.getDay()] = d.toISOString().split("T")[0];
    }
    return dates;
  },

  // ===== Detect Conflicting Intents =====
  hasConflicts(text) {
    const conflictPatterns = [
      /ngày \d+.*ngày \d+/,       // Two different dates
      /à không|ý tôi là|đổi sang|thay đổi bằng/,
      /hay.*cũng được/,            // Or / either
    ];
    return conflictPatterns.some(p => p.test(text.toLowerCase()));
  },

  // ===== Main Process =====
  process(text, callbacks) {
    // Check for conflicts first
    if (this.hasConflicts(text)) {
      this.conflictCount++;
      if (this.conflictCount >= 3) {
        this.conflictCount = 0;
        this.currentFlow = null;
        callbacks.onEscalate();
        return;
      }
      callbacks.onClarify(this.conflictCount);
      return;
    }
    this.conflictCount = 0;

    const intent = this.detectIntent(text);
    const params = this.extractParams(text);

    // Execute current flow step or start new flow
    if (this.currentFlow === "SEARCH" || intent === "SEARCH") {
      this.handleSearch(text, params, intent, callbacks);
    } else if (this.currentFlow === "GROUP_SEARCH" || intent === "GROUP_SEARCH") {
      this.handleGroupSearch(text, params, intent, callbacks);
    } else if (this.currentFlow === "CHECKIN" || intent === "CHECKIN") {
      this.handleCheckin(text, params, intent, callbacks);
    } else if (intent === "ESCALATE") {
      callbacks.onEscalate();
    } else {
      callbacks.onUnknown();
    }
  },

  // ===== UC-02: Multi-field Search =====
  handleSearch(text, params, intent, callbacks) {
    this.currentFlow = "SEARCH";
    const state = this.flowState;

    // Merge extracted params
    Object.assign(state, params);

    // Check what's still missing
    const missing = [];
    if (!state.destination) missing.push("điểm đến");
    if (!state.date) missing.push("ngày bay");

    if (missing.length > 0) {
      callbacks.onAskFollowUp(`Cho tôi hỏi thêm: bạn muốn bay đến đâu và ngày nào ạ?`);
      return;
    }

    // Set defaults
    if (!state.origin) state.origin = "Hà Nội";
    if (!state.class) state.class = "any";

    // Search
    const results = MockAPI.searchFlights({
      origin: state.origin,
      destination: state.destination,
      date: state.date,
      maxPrice: state.maxPrice,
      minDeparture: state.minDep,
      maxDeparture: state.maxDep,
      cls: state.class
    });

    if (results.length === 0) {
      callbacks.onNoResults(state);
      this.flowState = {};
      this.currentFlow = null;
    } else {
      // Add route info to results
      results.forEach(r => { r.origin = state.origin; r.destination = state.destination; });
      callbacks.onSearchResults(results, state);
    }
  },

  // ===== UC-03: Group/Complex Search =====
  handleGroupSearch(text, params, intent, callbacks) {
    this.currentFlow = "GROUP_SEARCH";
    const state = this.flowState;
    const t = text.toLowerCase();

    Object.assign(state, params);

    // Detect special needs
    state.needsWheelchair = /đau khớp|đi lại khó|xe lăn|cần hỗ trợ|người già/.test(t) || state.needsWheelchair;
    state.needsBassinet = /bé 1\.?5|bé 1 tuổi|18 tháng|dưới 2 tuổi|em bé|nôi|bassinet/.test(t) || state.needsBassinet;
    state.hasSenior = /68 tuổi|70 tuổi|người cao tuổi|senior|bà cụ|ông cụ/.test(t) || state.hasSenior;

    // Parse passenger counts
    if (!state.adults) {
      const m = t.match(/(\d+)\s*người lớn/);
      state.adults = m ? parseInt(m[1]) : 1;
    }

    const missing = [];
    if (!state.destination) missing.push("điểm đến");
    if (!state.date) missing.push("ngày bay");

    if (missing.length > 0) {
      callbacks.onAskFollowUp("Quý khách muốn bay đến đâu và vào ngày nào ạ? Tôi sẽ tìm chuyến phù hợp cho cả gia đình.");
      return;
    }

    if (!state.origin) state.origin = "Hồ Chí Minh";

    const results = MockAPI.searchFlights({
      origin: state.origin,
      destination: state.destination,
      date: state.date,
      cls: "any"
    });

    results.forEach(r => { r.origin = state.origin; r.destination = state.destination; });
    callbacks.onGroupResults(results, state);
  },

  // ===== UC-04: Check-in =====
  handleCheckin(text, params, intent, callbacks) {
    this.currentFlow = "CHECKIN";
    const state = this.flowState;

    // Check if user provided PNR code
    const pnrMatch = text.match(/\b([A-Z]{3}\d{3}|[A-Z\d]{6})\b/i);
    if (pnrMatch) {
      const pnr = pnrMatch[1].toUpperCase();
      const booking = MockAPI.lookupPNR(pnr);
      if (booking) {
        callbacks.onCheckinFound(booking);
        this.currentFlow = null;
        this.flowState = {};
      } else {
        callbacks.onCheckinNotFound(pnr);
      }
      return;
    }

    // No PNR yet - waiting for upload or manual entry
    if (!state.waitingForPNR) {
      state.waitingForPNR = true;
      callbacks.onAskForPNR();
    } else {
      callbacks.onAskForPNR();
    }
  },

  // ===== Flight selected - prepare confirmation =====
  selectFlight(flight, extraInfo) {
    this.flowState.selectedFlight = flight;
    this.flowState.extraInfo = extraInfo || {};
  },

  reset() {
    this.currentFlow = null;
    this.flowState = {};
    this.conflictCount = 0;
  }
};

window.ChatEngine = ChatEngine;
