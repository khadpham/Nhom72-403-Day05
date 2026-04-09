// ===================================================
// MOCK API - Vietnam Airlines AI Assistant
// Converts mock_data CSVs to JS objects
// ===================================================

const MockDB = {
  customers: [
    { id: "CUST_001", name: "TRAN HUNG", passport: "F91846634", email: "hung.tran@email.com", tier: "Gold", points: 45200 },
    { id: "CUST_002", name: "TRAN DUNG", passport: "E24601158", email: "dung.tran@email.com", tier: "Silver", points: 12800 },
    { id: "CUST_003", name: "VU ANH", passport: "E67860543", email: "anh.vu@email.com", tier: "Gold", points: 38500 },
    { id: "CUST_004", name: "TRAN ANH", passport: "B48309592", email: "anh.tran@email.com", tier: "Silver", points: 9400 },
    { id: "CUST_005", name: "VU NAM", passport: "H66203114", email: "nam.vu@email.com", tier: "Platinum", points: 87600 },
    { id: "CUST_006", name: "LE ANH", passport: "A79396099", email: "anh.le@email.com", tier: "Silver", points: 15300 },
    { id: "CUST_007", name: "VU DUNG", passport: "H37298214", email: "dung.vu@email.com", tier: "Gold", points: 52100 },
    { id: "CUST_008", name: "NGUYEN ANH", passport: "A38147452", email: "anh.nguyen@email.com", tier: "Silver", points: 7200 },
  ],

  bookingHistory: [
    { id: "BK_1001", customerId: "CUST_008", flightNumber: "VN984", date: "2026-04-24", seat: "6F", class: "economy", status: "Confirmed", origin: "Hà Nội", destination: "Hồ Chí Minh" },
    { id: "BK_1007", customerId: "CUST_006", flightNumber: "KE738", date: "2026-04-18", seat: "7B", class: "business", status: "Confirmed", origin: "Hà Nội", destination: "Đà Nẵng" },
    { id: "BK_1014", customerId: "CUST_013", flightNumber: "VN984", date: "2026-04-15", seat: "28B", class: "business", status: "Confirmed", origin: "Hà Nội", destination: "Hồ Chí Minh" },
    { id: "BK_1023", customerId: "CUST_007", flightNumber: "VN984", date: "2026-04-24", seat: "12B", class: "economy", status: "Confirmed", origin: "Hà Nội", destination: "Hồ Chí Minh" },
    { id: "BK_1040", customerId: "CUST_001", flightNumber: "VJ256", date: "2026-04-22", seat: "29A", class: "economy", status: "Confirmed", origin: "Hà Nội", destination: "Seoul" },
    { id: "BK_1041", customerId: "CUST_007", flightNumber: "VJ890", date: "2026-04-22", seat: "1A", class: "economy", status: "Confirmed", origin: "Hồ Chí Minh", destination: "Phú Quốc" },
    { id: "BK_1046", customerId: "CUST_007", flightNumber: "VN733", date: "2026-04-19", seat: "9C", class: "business", status: "Confirmed", origin: "Hồ Chí Minh", destination: "Phú Quốc" },
  ],

  // CDPProfile: Thói quen bay của từng khách hàng VIP
  cdpProfiles: {
    "CUST_007": {
      favoriteRoute: { origin: "Hà Nội", destination: "Đà Nẵng" },
      favoriteDay: "Thứ Bảy",
      favoriteTime: "buổi sáng",
      favoriteClass: "economy",
      lastFlight: { date: "2026-03-29", route: "Hà Nội → Đà Nẵng" },
      upgradeOffer: "Giảm 30% phí chọn ghế và ưu đãi hành lý cho Hội viên Vàng"
    },
    "CUST_005": {
      favoriteRoute: { origin: "Hồ Chí Minh", destination: "Phú Quốc" },
      favoriteDay: "Thứ Sáu",
      favoriteTime: "buổi chiều",
      favoriteClass: "business",
      lastFlight: { date: "2026-03-21", route: "Hồ Chí Minh → Phú Quốc" },
      upgradeOffer: "Ưu đãi đặc biệt Platinum: Nâng cấp miễn phí hành lý 10kg"
    },
    "CUST_001": {
      favoriteRoute: { origin: "Hà Nội", destination: "Hồ Chí Minh" },
      favoriteDay: "Thứ Hai",
      favoriteTime: "buổi sáng sớm",
      favoriteClass: "business",
      lastFlight: { date: "2026-03-30", route: "Hà Nội → Hồ Chí Minh" },
      upgradeOffer: "Tặng 2000 dặm Lotusmiles cho chuyến bay tiếp theo"
    }
  },

  // Mock PNR lookup
  pnrDatabase: {
    "ABC123": { pnr: "ABC123", passengerName: "NGUYEN VAN AN", flight: "VN984", date: "2026-04-18", seat: "12C", class: "economy", origin: "Hà Nội", destination: "Hồ Chí Minh", departure: "11:30", gate: "B5" },
    "XYZ789": { pnr: "XYZ789", passengerName: "TRAN THI BINH", flight: "VN163", date: "2026-04-14", seat: "4A", class: "business", origin: "Hà Nội", destination: "Đà Nẵng", departure: "08:30", gate: "A3" },
    "DEF456": { pnr: "DEF456", passengerName: "LE VAN CUONG", flight: "VN1823", date: "2026-04-16", seat: "22B", class: "economy", origin: "Hồ Chí Minh", destination: "Phú Quốc", departure: "08:30", gate: "C2" },
  },

  // Full flight data (subset for key routes)
  flightData: {
    "Hà Nội_Đà Nẵng": [
      { fn: "VN163", airline: "Vietnam Airlines", dep: "06:30", arr: "07:50", date: "2026-04-12", price: 1750000, cls: "economy", seats: 15, duration: "1h 20m" },
      { fn: "VN189", airline: "Vietnam Airlines", dep: "18:30", arr: "19:50", date: "2026-04-12", price: 3100000, cls: "business", seats: 4, duration: "1h 20m" },
      { fn: "VJ512", airline: "VietJet Air", dep: "11:15", arr: "12:35", date: "2026-04-12", price: 850000, cls: "economy", seats: 32, duration: "1h 20m" },
      { fn: "QH105", airline: "Bamboo Airways", dep: "15:00", arr: "16:20", date: "2026-04-12", price: 1150000, cls: "economy", seats: 21, duration: "1h 20m" },
      { fn: "VN165", airline: "Vietnam Airlines", dep: "07:15", arr: "08:35", date: "2026-04-13", price: 1850000, cls: "economy", seats: 12, duration: "1h 20m" },
      { fn: "VJ518", airline: "VietJet Air", dep: "21:30", arr: "22:50", date: "2026-04-13", price: 780000, cls: "economy", seats: 45, duration: "1h 20m" },
      { fn: "VN163", airline: "Vietnam Airlines", dep: "06:45", arr: "08:05", date: "2026-04-15", price: 1800000, cls: "economy", seats: 22, duration: "1h 20m" },
      { fn: "VN193", airline: "Vietnam Airlines", dep: "19:30", arr: "20:50", date: "2026-04-15", price: 3400000, cls: "business", seats: 3, duration: "1h 20m" },
      { fn: "VN165", airline: "Vietnam Airlines", dep: "07:30", arr: "08:50", date: "2026-04-16", price: 1900000, cls: "economy", seats: 19, duration: "1h 20m" },
      { fn: "VJ514", airline: "VietJet Air", dep: "10:45", arr: "12:05", date: "2026-04-16", price: 780000, cls: "economy", seats: 50, duration: "1h 20m" },
      { fn: "VN163", airline: "Vietnam Airlines", dep: "06:15", arr: "07:35", date: "2026-04-17", price: 1850000, cls: "economy", seats: 20, duration: "1h 20m" },
      { fn: "VN191", airline: "Vietnam Airlines", dep: "20:00", arr: "21:20", date: "2026-04-17", price: 3000000, cls: "business", seats: 4, duration: "1h 20m" },
    ],
    "Hà Nội_Hồ Chí Minh": [
      { fn: "VN211", airline: "Vietnam Airlines", dep: "07:00", arr: "09:10", date: "2026-04-11", price: 1850000, cls: "economy", seats: 8, duration: "2h 10m" },
      { fn: "VJ135", airline: "VietJet Air", dep: "14:00", arr: "16:10", date: "2026-04-11", price: 820000, cls: "economy", seats: 25, duration: "2h 10m" },
      { fn: "VN255", airline: "Vietnam Airlines", dep: "18:30", arr: "20:40", date: "2026-04-11", price: 3600000, cls: "business", seats: 2, duration: "2h 10m" },
      { fn: "VJ121", airline: "VietJet Air", dep: "06:15", arr: "08:25", date: "2026-04-12", price: 1100000, cls: "economy", seats: 18, duration: "2h 10m" },
      { fn: "VN213", airline: "Vietnam Airlines", dep: "08:45", arr: "10:55", date: "2026-04-12", price: 1950000, cls: "economy", seats: 12, duration: "2h 10m" },
      { fn: "VN211", airline: "Vietnam Airlines", dep: "07:30", arr: "09:40", date: "2026-04-15", price: 1950000, cls: "economy", seats: 16, duration: "2h 10m" },
      { fn: "VJ141", airline: "VietJet Air", dep: "10:00", arr: "12:10", date: "2026-04-16", price: 780000, cls: "economy", seats: 48, duration: "2h 10m" },
      { fn: "VN215", airline: "Vietnam Airlines", dep: "09:00", arr: "11:10", date: "2026-04-14", price: 2000000, cls: "economy", seats: 11, duration: "2h 10m" },
      { fn: "VN255", airline: "Vietnam Airlines", dep: "18:45", arr: "20:55", date: "2026-04-14", price: 3600000, cls: "business", seats: 6, duration: "2h 10m" },
    ],
    "Hồ Chí Minh_Phú Quốc": [
      { fn: "VN1823", airline: "Vietnam Airlines", dep: "07:30", arr: "08:30", date: "2026-04-11", price: 1350000, cls: "economy", seats: 12, duration: "1h 00m" },
      { fn: "VJ323", airline: "VietJet Air", dep: "11:00", arr: "12:00", date: "2026-04-11", price: 650000, cls: "economy", seats: 20, duration: "1h 00m" },
      { fn: "VN1825", airline: "Vietnam Airlines", dep: "18:30", arr: "19:30", date: "2026-04-11", price: 2500000, cls: "business", seats: 4, duration: "1h 00m" },
      { fn: "VN1827", airline: "Vietnam Airlines", dep: "08:15", arr: "09:15", date: "2026-04-12", price: 1400000, cls: "economy", seats: 14, duration: "1h 00m" },
      { fn: "VJ327", airline: "VietJet Air", dep: "12:30", arr: "13:30", date: "2026-04-13", price: 620000, cls: "economy", seats: 45, duration: "1h 00m" },
      { fn: "VN1827", airline: "Vietnam Airlines", dep: "09:00", arr: "10:00", date: "2026-04-14", price: 1450000, cls: "economy", seats: 9, duration: "1h 00m" },
      { fn: "VN1831", airline: "Vietnam Airlines", dep: "18:15", arr: "19:15", date: "2026-04-14", price: 2450000, cls: "business", seats: 5, duration: "1h 00m" },
      { fn: "VJ323", airline: "VietJet Air", dep: "10:00", arr: "11:00", date: "2026-04-16", price: 600000, cls: "economy", seats: 50, duration: "1h 00m" },
      { fn: "VN1823", airline: "Vietnam Airlines", dep: "07:15", arr: "08:15", date: "2026-04-17", price: 1380000, cls: "economy", seats: 15, duration: "1h 00m" },
      { fn: "VJ333", airline: "VietJet Air", dep: "12:00", arr: "13:00", date: "2026-04-17", price: 650000, cls: "economy", seats: 44, duration: "1h 00m" },
    ],
    "Hà Nội_Seoul": [
      { fn: "VN414", airline: "Vietnam Airlines", dep: "22:45", arr: "04:45+1", date: "2026-04-11", price: 6800000, cls: "economy", seats: 12, duration: "5h 00m" },
      { fn: "KE680", airline: "Korean Air", dep: "11:30", arr: "17:30", date: "2026-04-11", price: 17600000, cls: "business", seats: 4, duration: "5h 00m" },
      { fn: "VN416", airline: "Vietnam Airlines", dep: "10:15", arr: "16:15", date: "2026-04-12", price: 7400000, cls: "economy", seats: 22, duration: "5h 00m" },
      { fn: "KE682", airline: "Korean Air", dep: "13:00", arr: "19:00", date: "2026-04-12", price: 8500000, cls: "economy", seats: 28, duration: "5h 00m" },
      { fn: "VN414", airline: "Vietnam Airlines", dep: "22:50", arr: "04:50+1", date: "2026-04-15", price: 6950000, cls: "economy", seats: 13, duration: "5h 00m" },
      { fn: "VN416", airline: "Vietnam Airlines", dep: "10:00", arr: "16:00", date: "2026-04-16", price: 7400000, cls: "economy", seats: 19, duration: "5h 00m" },
    ],
    "Hồ Chí Minh_Singapore": [
      { fn: "VN651", airline: "Vietnam Airlines", dep: "09:00", arr: "12:00", date: "2026-04-11", price: 3700000, cls: "economy", seats: 15, duration: "2h 00m" },
      { fn: "SQ183", airline: "Singapore Airlines", dep: "18:00", arr: "21:00", date: "2026-04-11", price: 5800000, cls: "business", seats: 4, duration: "2h 00m" },
      { fn: "VN653", airline: "Vietnam Airlines", dep: "10:15", arr: "13:15", date: "2026-04-12", price: 3800000, cls: "economy", seats: 14, duration: "2h 00m" },
    ]
  }
};

// ===================================================
// API methods
// ===================================================
const MockAPI = {

  // Search flights
  searchFlights({ origin, destination, date, maxPrice, minDeparture, maxDeparture, cls }) {
    const key = `${origin}_${destination}`;
    let results = (MockDB.flightData[key] || []).filter(f => f.airline === "Vietnam Airlines");

    if (date) results = results.filter(f => f.date === date);
    if (maxPrice) results = results.filter(f => f.price <= maxPrice);
    if (cls && cls !== "any") results = results.filter(f => f.cls === cls);
    if (minDeparture) {
      results = results.filter(f => {
        const depHour = parseInt(f.dep.split(":")[0]);
        return depHour >= parseInt(minDeparture);
      });
    }
    if (maxDeparture) {
      results = results.filter(f => {
        const depHour = parseInt(f.dep.split(":")[0]);
        return depHour <= parseInt(maxDeparture);
      });
    }

    return results.sort((a, b) => a.price - b.price);
  },

  // Get customer by ID
  getCustomer(customerId) {
    return MockDB.customers.find(c => c.id === customerId) || null;
  },

  // Get CDP profile
  getCDPProfile(customerId) {
    return MockDB.cdpProfiles[customerId] || null;
  },

  // Get booking history for customer
  getBookings(customerId) {
    return MockDB.bookingHistory.filter(b => b.customerId === customerId);
  },

  // PNR lookup
  lookupPNR(pnr) {
    return MockDB.pnrDatabase[pnr.toUpperCase()] || null;
  },

  // Generate booking redirect URL (AI does NOT pay, only redirects)
  getPaymentRedirectUrl(flightData, passengers) {
    const params = new URLSearchParams({
      fn: flightData.fn,
      origin: flightData.origin || "",
      destination: flightData.destination || "",
      date: flightData.date,
      cls: flightData.cls,
      pax: passengers || 1,
      price: flightData.price
    });
    return `#payment-redirect?${params.toString()}`;
  },

  // Simulate check-in
  doCheckin(pnrData) {
    return {
      success: true,
      boardingPass: {
        pnr: pnrData.pnr,
        name: pnrData.passengerName,
        flight: pnrData.flight,
        date: pnrData.date,
        origin: pnrData.origin,
        destination: pnrData.destination,
        departure: pnrData.departure,
        seat: pnrData.seat,
        gate: pnrData.gate,
        class: pnrData.class,
        boardingTime: pnrData.departure ? subtractMinutes(pnrData.departure, 40) : "N/A"
      }
    };
  }
};

function subtractMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m - mins;
  const rh = Math.floor(total / 60) % 24;
  const rm = total % 60;
  return `${String(rh).padStart(2, "0")}:${String(rm).padStart(2, "0")}`;
}

// Format price
function formatPrice(price) {
  return new Intl.NumberFormat("vi-VN").format(price) + " đ";
}

// Format date
function formatDate(dateStr) {
  const d = new Date(dateStr);
  const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  return `${days[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

window.MockAPI = MockAPI;
window.MockDB = MockDB;
window.formatPrice = formatPrice;
window.formatDate = formatDate;
