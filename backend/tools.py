"""NEO Vietnam Airlines tools dùng dữ liệu mock trong /mock_data (không gọi API thật)."""

from __future__ import annotations

import csv
import importlib.util
import re
import unicodedata
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

from langchain_core.tools import tool


BASE_DIR = Path(__file__).resolve().parent.parent
MOCK_DIR = BASE_DIR / "mock_data"


def _first_existing(candidates: list[str]) -> Path:
    for name in candidates:
        path = MOCK_DIR / name
        if path.exists():
            return path
    return MOCK_DIR / candidates[-1]


def _load_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []

    with open(path, newline="", encoding="utf-8") as file:
        rows: list[dict[str, str]] = []
        for raw_row in csv.DictReader(file):
            cleaned: dict[str, str] = {}
            for key, value in raw_row.items():
                normalized_key = (key or "").lstrip("\ufeff").strip()
                cleaned[normalized_key] = value if isinstance(value, str) else ("" if value is None else str(value))
            rows.append(cleaned)
        return rows


def _load_flight_data() -> dict[tuple[str, str], list[dict[str, Any]]]:
    data_file = MOCK_DIR / "data.py"
    if not data_file.exists():
        return {}

    spec = importlib.util.spec_from_file_location("neo_mock_data", data_file)
    if not spec or not spec.loader:
        return {}

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    value = getattr(module, "flight_data", {})
    return value if isinstance(value, dict) else {}


def _strip_accents(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text or "")
    stripped = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return stripped.replace("đ", "d").replace("Đ", "D")


def _norm_text(text: str) -> str:
    return _strip_accents(text).lower().strip()


def _to_int(value: Any) -> int:
    if value is None:
        return 0
    text = str(value).strip()
    if not text:
        return 0

    text = text.replace(".", "").replace(",", "")
    try:
        return int(float(text))
    except ValueError:
        return 0


def _fmt_price(price: int | float) -> str:
    value = int(price)
    return f"{value:,}".replace(",", ".") + "đ"


def _dep_hour(dep: str) -> int:
    try:
        return int(dep.split(":")[0])
    except (ValueError, IndexError):
        return 0


def _normalize_date_key(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""

    for fmt in (
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%m/%d/%Y",
        "%Y/%m/%d",
        "%d-%m-%Y",
        "%m-%d-%Y",
    ):
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue

    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).strftime("%Y-%m-%d")
    except ValueError:
        return text


def _duration(dep: str, arr: str) -> str:
    try:
        dep_h, dep_m = [int(x) for x in dep.split(":")]
        arr_h, arr_m = [int(x) for x in arr.replace("+1", "").split(":")]
        dep_total = dep_h * 60 + dep_m
        arr_total = arr_h * 60 + arr_m
        if "+1" in arr or arr_total < dep_total:
            arr_total += 24 * 60
        mins = max(arr_total - dep_total, 0)
        return f"{mins // 60}h {mins % 60:02d}m"
    except Exception:
        return "--"


def _canonical_class(value: str | None) -> str:
    text = _norm_text(value or "")
    if text in {"premium", "premium economy", "premium_economy", "pho thong dac biet"}:
        return "premium"
    if text in {"business", "thuong gia", "c"}:
        return "business"
    if text in {"economy", "pho thong", "y"}:
        return "economy"
    return text.replace(" ", "_")


def _class_label(value: str) -> str:
    mapping = {
        "economy": "Phổ thông",
        "premium": "Phổ thông đặc biệt",
        "business": "Thương gia",
    }
    return mapping.get(value, value.title())


def _is_vna_airline(airline: str | None) -> bool:
    text = _norm_text(airline or "")
    return "vietnam airlines" in text or text == "vna"


def _parse_datetime_safe(text: str | None) -> datetime:
    value = (text or "").strip()
    if not value:
        return datetime.min
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        pass

    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return datetime.min


CUSTOMERS = _load_csv(MOCK_DIR / "customers.csv")
BOOKINGS = _load_csv(MOCK_DIR / "booking_history.csv")
FLIGHTS_CSV = _load_csv(MOCK_DIR / "flights.csv")
FLIGHT_DATA = _load_flight_data()

SEAT_FILE = _first_existing(
    [
        "flight_seats_premium_logic.csv",
        "vna_master_seatmap.csv",
        "flight_seats_final_v2.csv",
        "flight_seats_with_time.csv",
    ]
)
SEAT_ROWS = _load_csv(SEAT_FILE)

CHAT_HISTORY_FILE = _first_existing(
    [
        "customer_chat_history_vna.csv",
        "customer_chat_history_v2.csv",
        "customer_chat_history.csv",
    ]
)
CUSTOMER_CHAT_HISTORY = _load_csv(CHAT_HISTORY_FILE)

CUSTOMERS_BY_ID = {row["customer_id"].upper(): row for row in CUSTOMERS if row.get("customer_id")}
FLIGHTS_BY_NUMBER = {
    row["flight_number"].upper(): row
    for row in FLIGHTS_CSV
    if row.get("flight_number") and _is_vna_airline(row.get("airline"))
}
BOOKINGS_BY_ID = {row["booking_id"].upper(): row for row in BOOKINGS if row.get("booking_id")}
BOOKINGS_BY_ID_NORMALIZED = {
    booking_id.replace("_", "").replace("-", ""): booking
    for booking_id, booking in BOOKINGS_BY_ID.items()
}
BOOKING_ID_BY_NORMALIZED = {
    booking_id.replace("_", "").replace("-", ""): booking_id
    for booking_id in BOOKINGS_BY_ID
}
BOOKINGS_BY_PNR = {
    row["pnr"].strip().upper(): row
    for row in BOOKINGS
    if row.get("pnr")
}

# Alias demo cũ để không vỡ các input ví dụ legacy.
PNR_ALIAS_TO_BOOKING = {
    "ABC123": "BK_1001",
    "XYZ789": "BK_1002",
    "DEF456": "BK_1003",
}

CHAT_HISTORY_BY_CUSTOMER: dict[str, list[dict[str, str]]] = {}
for row in CUSTOMER_CHAT_HISTORY:
    cid = row.get("customer_id", "").strip().upper()
    if not cid:
        continue
    CHAT_HISTORY_BY_CUSTOMER.setdefault(cid, []).append(row)

for cid in CHAT_HISTORY_BY_CUSTOMER:
    CHAT_HISTORY_BY_CUSTOMER[cid].sort(key=lambda item: _parse_datetime_safe(item.get("timestamp")), reverse=True)

FLIGHT_META_BY_KEY: dict[tuple[str, str], dict[str, str]] = {}
for row in SEAT_ROWS:
    fn = str(row.get("flight_number", "")).strip().upper()
    date = _normalize_date_key(row.get("date", ""))
    if not fn or not date:
        continue
    airline = str(row.get("airline", "")).strip()
    if not _is_vna_airline(airline):
        continue

    key = (fn, date)
    if key in FLIGHT_META_BY_KEY:
        continue

    FLIGHT_META_BY_KEY[key] = {
        "origin": str(row.get("origin", "")).strip(),
        "destination": str(row.get("destination", "")).strip(),
        "departure": str(row.get("departure", "")).strip(),
        "arrival": str(row.get("arrival", "")).strip(),
    }


def _build_flight_options_from_seats() -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str, str, str, str, str, str, str], dict[str, Any]] = {}

    for seat in SEAT_ROWS:
        fn = str(seat.get("flight_number", "")).strip().upper()
        if not fn:
            continue

        info = FLIGHTS_BY_NUMBER.get(fn, {})
        airline = str(seat.get("airline") or info.get("airline") or "").strip()
        if not _is_vna_airline(airline):
            continue

        origin = str(seat.get("origin") or info.get("origin") or "").strip()
        destination = str(seat.get("destination") or info.get("destination") or "").strip()
        date = _normalize_date_key(seat.get("date") or "")
        departure = str(seat.get("departure") or info.get("standard_departure") or "").strip()
        arrival = str(seat.get("arrival") or "--:--").strip()
        cls = _canonical_class(seat.get("class"))

        if not all([fn, origin, destination, date, departure, cls]):
            continue

        key = (fn, "Vietnam Airlines", origin, destination, date, departure, arrival, cls)
        row = grouped.setdefault(
            key,
            {
                "flight_number": fn,
                "airline": "Vietnam Airlines",
                "origin": origin,
                "destination": destination,
                "date": date,
                "departure": departure,
                "arrival": arrival,
                "class": cls,
                "total_seats": 0,
                "available_seats": 0,
                "min_any_price": None,
                "min_available_price": None,
            },
        )

        price = _to_int(seat.get("seat_price") or seat.get("price"))
        status = str(seat.get("status", "")).strip().lower()

        row["total_seats"] += 1
        if price > 0:
            current_any = row["min_any_price"]
            row["min_any_price"] = price if current_any is None else min(current_any, price)

        if status == "available":
            row["available_seats"] += 1
            if price > 0:
                current_available = row["min_available_price"]
                row["min_available_price"] = price if current_available is None else min(current_available, price)

    options: list[dict[str, Any]] = []
    for row in grouped.values():
        available = int(row.get("available_seats", 0) or 0)
        if available <= 0:
            continue

        price = row.get("min_available_price") or row.get("min_any_price") or 0
        departure = str(row.get("departure", "--:--"))
        arrival = str(row.get("arrival", "--:--"))

        options.append(
            {
                "fn": row["flight_number"],
                "flight_number": row["flight_number"],
                "airline": row["airline"],
                "origin": row["origin"],
                "destination": row["destination"],
                "date": row["date"],
                "dep": departure,
                "arr": arrival,
                "departure": departure,
                "arrival": arrival,
                "cls": row["class"],
                "class": row["class"],
                "price": int(price),
                "seats": available,
                "available_seats": available,
                "duration": _duration(departure, arrival),
            }
        )

    return options


def _build_flight_options_from_route_data() -> list[dict[str, Any]]:
    options: list[dict[str, Any]] = []
    for (origin, destination), flights in FLIGHT_DATA.items():
        for flight in flights:
            if not _is_vna_airline(str(flight.get("airline", ""))):
                continue

            flight_class = _canonical_class(str(flight.get("class", "economy")))
            departure = str(flight.get("departure", "--:--"))
            arrival = str(flight.get("arrival", "--:--"))
            seats = int(flight.get("available_seats", 0) or 0)
            if seats <= 0:
                continue

            options.append(
                {
                    "fn": str(flight.get("flight_number", "")).upper(),
                    "flight_number": str(flight.get("flight_number", "")).upper(),
                    "airline": "Vietnam Airlines",
                    "origin": origin,
                    "destination": destination,
                    "date": _normalize_date_key(flight.get("date", "")),
                    "dep": departure,
                    "arr": arrival,
                    "departure": departure,
                    "arrival": arrival,
                    "cls": flight_class,
                    "class": flight_class,
                    "price": int(flight.get("price", 0) or 0),
                    "seats": seats,
                    "available_seats": seats,
                    "duration": _duration(departure, arrival),
                }
            )
    return options


FLIGHT_OPTIONS = _build_flight_options_from_seats()
if not FLIGHT_OPTIONS:
    FLIGHT_OPTIONS = _build_flight_options_from_route_data()


CITY_ALIASES = {
    "hà nội": "Hà Nội",
    "ha noi": "Hà Nội",
    "hanoi": "Hà Nội",
    "han": "Hà Nội",
    "hn": "Hà Nội",
    "hồ chí minh": "Hồ Chí Minh",
    "ho chi minh": "Hồ Chí Minh",
    "ho chi minh city": "Hồ Chí Minh",
    "tp hcm": "Hồ Chí Minh",
    "tp.hcm": "Hồ Chí Minh",
    "tphcm": "Hồ Chí Minh",
    "hcm": "Hồ Chí Minh",
    "hcmc": "Hồ Chí Minh",
    "sài gòn": "Hồ Chí Minh",
    "sai gon": "Hồ Chí Minh",
    "sgn": "Hồ Chí Minh",
    "đà nẵng": "Đà Nẵng",
    "da nang": "Đà Nẵng",
    "danang": "Đà Nẵng",
    "dad": "Đà Nẵng",
    "dng": "Đà Nẵng",
    "phú quốc": "Phú Quốc",
    "phu quoc": "Phú Quốc",
    "pqc": "Phú Quốc",
    "seoul": "Seoul",
    "icn": "Seoul",
    "singapore": "Singapore",
    "sin": "Singapore",
    "tokyo": "Tokyo",
    "nrt": "Tokyo",
    "bangkok": "Bangkok",
    "bkk": "Bangkok",
    "hong kong": "Hong Kong",
    "hkg": "Hong Kong",
    "sydney": "Sydney",
    "syd": "Sydney",
}


def _search_city_mentions(text: str) -> list[str]:
    normalized = _norm_text(text)
    mentions: list[tuple[int, str]] = []

    for alias, canonical in CITY_ALIASES.items():
        alias_norm = _norm_text(alias)
        for match in re.finditer(rf"(?<!\w){re.escape(alias_norm)}(?!\w)", normalized):
            mentions.append((match.start(), canonical))

    mentions.sort(key=lambda item: item[0])
    ordered: list[str] = []
    for _, city in mentions:
        if city not in ordered:
            ordered.append(city)
    return ordered


def _canonical_city_name(value: str | None) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""
    return CITY_ALIASES.get(_norm_text(raw), raw)


def _parse_number(text: str) -> float:
    token = text.strip().replace(" ", "")
    if not token:
        return 0.0

    if token.count(",") == 1 and token.count(".") == 0:
        token = token.replace(",", ".")
        try:
            return float(token)
        except ValueError:
            return 0.0

    if token.count(".") == 1 and token.count(",") == 0 and len(token.split(".")[1]) <= 2:
        try:
            return float(token)
        except ValueError:
            return 0.0

    token = token.replace(".", "").replace(",", "")
    try:
        return float(token)
    except ValueError:
        return 0.0


def _parse_date_from_text(message: str) -> Optional[str]:
    text = _norm_text(message)
    now = datetime.now()

    iso_match = re.search(r"\b(20\d{2}-\d{2}-\d{2})\b", text)
    if iso_match:
        return iso_match.group(1)

    if "ngay mai" in text or "tomorrow" in text:
        return (now + timedelta(days=1)).strftime("%Y-%m-%d")

    day_month = re.search(r"(?:ngay\s*)?(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?", text)
    if day_month:
        first = int(day_month.group(1))
        second = int(day_month.group(2))
        year = int(day_month.group(3)) if day_month.group(3) else now.year

        # Mặc định ưu tiên dd/mm theo thói quen VN, nhưng vẫn chấp nhận mm/dd (ví dụ 4/15/2026).
        candidates: list[tuple[int, int, int]] = [(year, second, first)]
        if first <= 12 and second <= 31:
            candidates.append((year, first, second))

        seen: set[tuple[int, int, int]] = set()
        for y, month, day in candidates:
            if (y, month, day) in seen:
                continue
            seen.add((y, month, day))

            try:
                candidate = datetime(y, month, day)
                if not day_month.group(3) and candidate.date() < now.date():
                    candidate = datetime(y + 1, month, day)
                return candidate.strftime("%Y-%m-%d")
            except ValueError:
                continue

    day_only = re.search(r"ngay\s*(\d{1,2})(?!\d)", text)
    if day_only:
        day = int(day_only.group(1))
        month = now.month
        year = now.year
        try:
            candidate = datetime(year, month, day)
            if candidate.date() < now.date():
                if month == 12:
                    year += 1
                    month = 1
                else:
                    month += 1
                candidate = datetime(year, month, day)
            return candidate.strftime("%Y-%m-%d")
        except ValueError:
            return None

    weekday_map = {
        "thu 2": 0,
        "thu hai": 0,
        "thu 3": 1,
        "thu ba": 1,
        "thu 4": 2,
        "thu tu": 2,
        "thu 5": 3,
        "thu nam": 3,
        "thu 6": 4,
        "thu sau": 4,
        "thu 7": 5,
        "thu bay": 5,
        "chu nhat": 6,
        "sunday": 6,
        "monday": 0,
        "tuesday": 1,
        "wednesday": 2,
        "thursday": 3,
        "friday": 4,
        "saturday": 5,
    }

    target_weekday = None
    for key, value in weekday_map.items():
        if key in text:
            target_weekday = value
            break

    if target_weekday is not None:
        today_weekday = now.weekday()
        delta = (target_weekday - today_weekday) % 7
        if delta == 0:
            delta = 7
        return (now + timedelta(days=delta)).strftime("%Y-%m-%d")

    return None


def infer_search_filters_from_text(message: str) -> dict[str, Any]:
    """Bóc tách bộ lọc tìm vé từ câu người dùng để dùng cho luồng redirect/list trang vé."""
    text = _norm_text(message)
    cities = _search_city_mentions(message)

    origin: str | None = None
    destination: str | None = None
    if len(cities) >= 2:
        origin, destination = cities[0], cities[1]
    elif len(cities) == 1:
        destination = cities[0]

    if not origin:
        from_match = re.search(r"(?:tu|from)\s+([a-z\s]+)", text)
        if from_match:
            chunk = from_match.group(1).strip()
            for alias, canonical in CITY_ALIASES.items():
                if _norm_text(alias) in chunk:
                    origin = canonical
                    break

    if not destination:
        to_match = re.search(r"(?:den|toi|di|to)\s+([a-z\s]+)", text)
        if to_match:
            chunk = to_match.group(1).strip()
            for alias, canonical in CITY_ALIASES.items():
                if _norm_text(alias) in chunk:
                    destination = canonical
                    break

    max_price: int | None = None
    price_match = re.search(r"(?:duoi|toi da|max|under|<=?)\s*([\d\.,]+)\s*(trieu|tr|k|nghin|ngan|vnd|d|đ)?", text)
    if price_match:
        amount = _parse_number(price_match.group(1))
        unit = (price_match.group(2) or "").strip()
        if unit in {"trieu", "tr"}:
            amount *= 1_000_000
        elif unit in {"k", "nghin", "ngan"}:
            amount *= 1_000
        max_price = int(amount)

    flight_class: str | None = None
    if any(token in text for token in ["premium economy", "premium", "pho thong dac biet"]):
        flight_class = "premium"
    elif any(token in text for token in ["business", "thuong gia", "hang c"]):
        flight_class = "business"
    elif any(token in text for token in ["economy", "pho thong", "hang y"]):
        flight_class = "economy"

    min_departure_hour: int | None = None
    max_departure_hour: int | None = None

    if any(token in text for token in ["buoi sang", "sang", "morning"]):
        min_departure_hour, max_departure_hour = 5, 12
    elif any(token in text for token in ["buoi chieu", "chieu", "afternoon"]):
        min_departure_hour, max_departure_hour = 12, 18
    elif any(token in text for token in ["buoi toi", "toi", "evening", "night"]):
        min_departure_hour, max_departure_hour = 18, 23

    after_match = re.search(r"(?:sau|after)\s*(\d{1,2})\s*h?", text)
    if after_match:
        min_departure_hour = int(after_match.group(1))

    before_match = re.search(r"(?:truoc|before)\s*(\d{1,2})\s*h?", text)
    if before_match:
        max_departure_hour = int(before_match.group(1))

    return {
        "origin": origin,
        "destination": destination,
        "date": _parse_date_from_text(message),
        "max_price": max_price,
        "flight_class": flight_class,
        "min_departure_hour": min_departure_hour,
        "max_departure_hour": max_departure_hour,
    }


def search_flight_records(
    origin: str,
    destination: str,
    date: Optional[str] = None,
    max_price: Optional[int] = None,
    flight_class: Optional[str] = None,
    min_departure_hour: Optional[int] = None,
    max_departure_hour: Optional[int] = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """Tìm chuyến bay có cấu trúc để phục vụ API/UI."""
    origin_norm = _norm_text(_canonical_city_name(origin))
    destination_norm = _norm_text(_canonical_city_name(destination))
    normalized_date = _normalize_date_key(date) if date else None
    expected_class = _canonical_class(flight_class or "") if flight_class else None

    filtered: list[dict[str, Any]] = []
    for flight in FLIGHT_OPTIONS:
        if _norm_text(str(flight.get("origin", ""))) != origin_norm:
            continue
        if _norm_text(str(flight.get("destination", ""))) != destination_norm:
            continue
        if normalized_date and _normalize_date_key(flight.get("date", "")) != normalized_date:
            continue
        if expected_class and expected_class != str(flight.get("class", "")):
            continue

        price = int(flight.get("price", 0) or 0)
        if max_price is not None and price > max_price:
            continue

        dep_hour = _dep_hour(str(flight.get("departure", "")))
        if min_departure_hour is not None and dep_hour < min_departure_hour:
            continue
        if max_departure_hour is not None and dep_hour > max_departure_hour:
            continue

        seats = int(flight.get("available_seats", 0) or 0)
        if seats <= 0:
            continue

        filtered.append(dict(flight))

    filtered.sort(
        key=lambda item: (
            int(item.get("price", 0) or 0),
            str(item.get("date", "")),
            str(item.get("departure", "")),
        )
    )
    if limit > 0:
        return filtered[:limit]
    return filtered


def _find_booking_by_code(code: str) -> tuple[Optional[str], Optional[dict[str, str]]]:
    normalized_code = code.strip().upper()

    # Alias cũ -> booking id mới
    alias_booking_id = PNR_ALIAS_TO_BOOKING.get(normalized_code)
    if alias_booking_id and alias_booking_id in BOOKINGS_BY_ID:
        return alias_booking_id, BOOKINGS_BY_ID[alias_booking_id]

    # PNR thực tế
    if normalized_code in BOOKINGS_BY_PNR:
        booking = BOOKINGS_BY_PNR[normalized_code]
        booking_id = str(booking.get("booking_id", "")).upper()
        if booking_id:
            return booking_id, booking

    # Booking id nguyên bản
    if normalized_code in BOOKINGS_BY_ID:
        return normalized_code, BOOKINGS_BY_ID[normalized_code]

    # Booking id bỏ ký tự _ / -
    normalized_booking_id = normalized_code.replace("_", "").replace("-", "")
    booking = BOOKINGS_BY_ID_NORMALIZED.get(normalized_booking_id)
    booking_id = BOOKING_ID_BY_NORMALIZED.get(normalized_booking_id)
    if booking_id and booking:
        return booking_id, booking

    return None, None


def _booking_route_info(booking: dict[str, str]) -> dict[str, str]:
    flight_number = str(booking.get("flight_number", "")).upper()
    flight_date = _normalize_date_key(booking.get("flight_date", ""))
    seat_meta = FLIGHT_META_BY_KEY.get((flight_number, flight_date), {})
    schedule = FLIGHTS_BY_NUMBER.get(flight_number, {})

    return {
        "origin": seat_meta.get("origin") or schedule.get("origin") or "--",
        "destination": seat_meta.get("destination") or schedule.get("destination") or "--",
        "departure": seat_meta.get("departure") or schedule.get("standard_departure") or "--:--",
        "arrival": seat_meta.get("arrival") or "--:--",
    }


def extract_valid_pnr_from_text(text: str) -> str | None:
    """Tìm PNR hợp lệ từ đoạn text tự do (ưu tiên pnr trong booking_history.csv)."""
    normalized = (text or "").upper()

    for token in re.findall(r"(?<![A-Z0-9])[A-Z0-9]{6}(?![A-Z0-9])", normalized):
        if token in BOOKINGS_BY_PNR:
            return token
        alias_booking_id = PNR_ALIAS_TO_BOOKING.get(token)
        if alias_booking_id and alias_booking_id in BOOKINGS_BY_ID:
            alias_booking = BOOKINGS_BY_ID[alias_booking_id]
            pnr = str(alias_booking.get("pnr", "")).upper().strip()
            if pnr:
                return pnr

    for booking_token in re.findall(r"(?<![A-Z0-9])BK[_-]?\d{4}(?![A-Z0-9])", normalized):
        booking_id, booking = _find_booking_by_code(booking_token)
        if booking_id and booking:
            pnr = str(booking.get("pnr", "")).upper().strip()
            if pnr:
                return pnr

    return None


def lookup_pnr_text(pnr_code: str) -> str:
    code = pnr_code.strip().upper()
    booking_id, booking = _find_booking_by_code(code)

    if not booking_id or not booking:
        sample_pnrs = list(BOOKINGS_BY_PNR.keys())[:3]
        sample_hint = ", ".join(sample_pnrs) if sample_pnrs else "(không có mẫu)"
        return (
            f"Không tìm thấy mã '{code}'. Vui lòng kiểm tra lại PNR hoặc mã booking.\n\n"
            f"💡 Bạn có thể thử PNR mẫu: {sample_hint}"
        )

    customer_id = booking.get("customer_id", "").upper()
    customer = CUSTOMERS_BY_ID.get(customer_id, {})
    flight_number = str(booking.get("flight_number", "")).upper()
    status = str(booking.get("booking_status", "Unknown"))
    status_norm = _norm_text(status)

    route_info = _booking_route_info(booking)
    departure = route_info["departure"]

    boarding = "--:--"
    if departure and departure != "--:--":
        try:
            h, m = [int(part) for part in departure.split(":")]
            total = h * 60 + m - 40
            boarding = f"{(total // 60) % 24:02d}:{total % 60:02d}"
        except Exception:
            boarding = "--:--"

    passenger_name = customer.get("full_name", "N/A")
    booking_class = _canonical_class(str(booking.get("class", "economy")))
    class_label = _class_label(booking_class)
    pnr_display = str(booking.get("pnr", "")).upper().strip() or code
    ticket_no = booking.get("ticket_number", "--")

    lines = [
        f"✅ Tìm thấy đặt chỗ: **{pnr_display}**",
        "",
        f"  🧾 Mã booking: {booking_id}",
        f"  🎟 Số vé: {ticket_no}",
        f"  👤 Hành khách: {passenger_name}",
        f"  ✈️ Chuyến bay: {flight_number}",
        f"  📍 Hành trình: {route_info['origin']} → {route_info['destination']}",
        f"  📅 Ngày bay: {booking.get('flight_date', '--')}",
        f"  🕐 Giờ cất cánh dự kiến: {route_info['departure']}",
        f"  💺 Ghế: {booking.get('seat_no', '--')} · Hạng: {class_label}",
        f"  ⏰ Giờ lên máy bay gợi ý: {boarding}",
        f"  📋 Trạng thái: {status}",
        "",
    ]

    if status_norm in {"cancelled", "canceled"}:
        lines.append("⚠️ Vé này đang ở trạng thái **Cancelled** nên chưa thể check-in online.")
    else:
        lines.append("Bạn có thể tiếp tục check-in online với mã PNR này ngay trong chat.")

    return "\n".join(lines)


def _route_key_from_booking(booking: dict[str, str]) -> str:
    route = _booking_route_info(booking)
    origin = route.get("origin") or "--"
    destination = route.get("destination") or "--"
    return f"{origin} → {destination}"


def get_customer_history_summary(
    customer_id: str,
    max_booking_items: int = 5,
    max_chat_items: int = 8,
    max_chars: int = 1800,
) -> str:
    """Tóm tắt profile + lịch sử giao dịch + lịch sử chat để inject prompt cá nhân hóa."""
    cid = customer_id.strip().upper()
    customer = CUSTOMERS_BY_ID.get(cid)
    if not customer:
        return ""

    customer_bookings = [item for item in BOOKINGS if item.get("customer_id", "").upper() == cid]
    customer_bookings.sort(key=lambda item: str(item.get("flight_date", "")), reverse=True)
    confirmed = [item for item in customer_bookings if _norm_text(item.get("booking_status", "")) == "completed"]

    route_counter = Counter(_route_key_from_booking(item) for item in confirmed)
    favorite_routes = [route for route, _ in route_counter.most_common(3)]

    chats = CHAT_HISTORY_BY_CUSTOMER.get(cid, [])
    sentiments = Counter((_norm_text(item.get("sentiment", "Neutral")) or "neutral") for item in chats)
    recent_chats = chats[:max_chat_items]

    lines = [
        f"CUSTOMER_CONTEXT for {cid}",
        f"- Name: {customer.get('full_name', 'N/A')}",
        f"- Email: {customer.get('email', 'N/A')}",
        f"- Total bookings: {len(customer_bookings)} (Completed: {len(confirmed)})",
    ]

    if favorite_routes:
        lines.append(f"- Favorite routes: {', '.join(favorite_routes)}")

    if customer_bookings:
        lines.append("- Recent bookings:")
        for booking in customer_bookings[:max_booking_items]:
            route = _route_key_from_booking(booking)
            lines.append(
                "  * "
                f"{booking.get('flight_date', '--')} · {route} · "
                f"{booking.get('flight_number', '--')} · {booking.get('class', '--')} · "
                f"status={booking.get('booking_status', '--')}"
            )

    if chats:
        lines.append(
            "- Chat sentiment summary: "
            f"positive={sentiments.get('positive', 0)}, "
            f"neutral={sentiments.get('neutral', 0)}, "
            f"negative={sentiments.get('negative', 0)}"
        )
        lines.append("- Recent chat intents (latest first):")
        for row in recent_chats:
            sentiment = row.get("sentiment", "Neutral")
            msg = " ".join((row.get("message", "") or "").split())
            if len(msg) > 120:
                msg = msg[:117] + "..."
            lines.append(f"  * [{sentiment}] {msg}")

    lines.append("- Personalization instruction: ưu tiên đề xuất chuyến bay phù hợp lịch sử và giọng văn theo sentiment gần đây.")

    summary = "\n".join(lines)
    if len(summary) > max_chars:
        summary = summary[:max_chars].rstrip() + "\n...(summary truncated)"
    return summary


@tool
def search_flight(
    origin: str,
    destination: str,
    date: Optional[str] = None,
    max_price: Optional[int] = None,
    flight_class: Optional[str] = None,
    min_departure_hour: Optional[int] = None,
    max_departure_hour: Optional[int] = None,
) -> str:
    """Tìm chuyến bay Vietnam Airlines theo tuyến + bộ lọc (ngày, giá, hạng, giờ khởi hành)."""
    flights = search_flight_records(
        origin=origin,
        destination=destination,
        date=date,
        max_price=max_price,
        flight_class=flight_class,
        min_departure_hour=min_departure_hour,
        max_departure_hour=max_departure_hour,
        limit=12,
    )

    if not flights:
        reverse_exists = bool(
            search_flight_records(
                origin=destination,
                destination=origin,
                date=date,
                max_price=max_price,
                flight_class=flight_class,
                min_departure_hour=min_departure_hour,
                max_departure_hour=max_departure_hour,
                limit=1,
            )
        )
        if reverse_exists:
            return (
                f"Hiện chưa có dữ liệu {origin} → {destination}, nhưng có chiều ngược lại "
                f"{destination} → {origin}. Bạn muốn tôi tra chiều về không?"
            )
        return (
            f"Không tìm thấy chuyến phù hợp cho {origin} → {destination} với bộ lọc hiện tại. "
            "Bạn có muốn nới lỏng điều kiện (giá/giờ/hạng) không?"
        )

    date_text = f" ngày {date}" if date else ""
    lines = [f"✈️ Danh sách chuyến Vietnam Airlines {origin} → {destination}{date_text} ({len(flights)} chuyến):", ""]

    for item in flights:
        dep = str(item.get("departure", "--:--"))
        arr = str(item.get("arrival", "--:--"))
        lines.append(
            f"• {item.get('flight_number')} · {item.get('airline')} · {item.get('date')}\n"
            f"  {dep} → {arr} ({item.get('duration') or _duration(dep, arr)})"
            f" · Hạng {_class_label(str(item.get('class', 'economy')))}"
            f" · Giá {_fmt_price(int(item.get('price', 0)))}"
            f" · Còn {item.get('available_seats')} ghế"
        )

    lines.append("\nBạn muốn tôi gợi ý chuyến tối ưu theo giá rẻ nhất hay theo giờ bay đẹp?")
    return "\n".join(lines)


def _find_flight_option(flight_number: str, date: str, flight_class: str) -> Optional[dict[str, Any]]:
    fn = flight_number.strip().upper()
    cls = _canonical_class(flight_class)
    normalized_date = _normalize_date_key(date)
    matches = [
        item
        for item in FLIGHT_OPTIONS
        if str(item.get("flight_number", "")).upper() == fn
        and _normalize_date_key(item.get("date", "")) == normalized_date
        and str(item.get("class", "")) == cls
    ]
    if not matches:
        return None
    return sorted(matches, key=lambda item: int(item.get("price", 0) or 0))[0]


def _calc_leg_total(base_price: int, adults: int, seniors: int, children: int, infants: int) -> tuple[int, list[str]]:
    adult_total = base_price * adults
    senior_total = int(base_price * 0.85) * seniors
    child_total = int(base_price * 0.75) * children
    infant_total = int(base_price * 0.10) * infants
    leg_total = adult_total + senior_total + child_total + infant_total

    breakdown: list[str] = []
    if adults:
        breakdown.append(f"  • Người lớn ({adults}): {_fmt_price(adult_total)}")
    if seniors:
        breakdown.append(f"  • Người cao tuổi ({seniors}, giảm 15%): {_fmt_price(senior_total)}")
    if children:
        breakdown.append(f"  • Trẻ em ({children}, 75%): {_fmt_price(child_total)}")
    if infants:
        breakdown.append(f"  • Em bé ({infants}, 10%): {_fmt_price(infant_total)}")

    return leg_total, breakdown


@tool
def calc_fee(
    outbound_flight_number: str,
    outbound_date: str,
    outbound_class: str,
    adults: int = 1,
    seniors: int = 0,
    children: int = 0,
    infants: int = 0,
    return_flight_number: Optional[str] = None,
    return_date: Optional[str] = None,
    return_class: Optional[str] = None,
) -> str:
    """Tính chi phí vé cho nhóm hành khách (1 chiều hoặc khứ hồi) trên chuyến đã chọn."""
    adults = max(int(adults), 0)
    seniors = max(int(seniors), 0)
    children = max(int(children), 0)
    infants = max(int(infants), 0)

    if adults + seniors + children + infants <= 0:
        return "Số lượng hành khách phải lớn hơn 0."

    required_seats = adults + seniors + children

    has_return = bool(return_flight_number or return_date or return_class)
    if has_return and (not return_flight_number or not return_date):
        return "Với vé khứ hồi, vui lòng cung cấp đầy đủ return_flight_number và return_date."

    if has_return and not return_class:
        return_class = outbound_class

    legs: list[dict[str, str]] = [
        {
            "label": "Chiều đi",
            "flight_number": str(outbound_flight_number),
            "date": str(outbound_date),
            "class": str(outbound_class),
        }
    ]

    if has_return:
        legs.append(
            {
                "label": "Chiều về",
                "flight_number": str(return_flight_number),
                "date": str(return_date),
                "class": str(return_class),
            }
        )

    total_all_legs = 0
    lines = [
        "💳 Ước tính chi phí đặt vé Vietnam Airlines",
        f"Nhóm khách: {adults} người lớn, {seniors} người cao tuổi, {children} trẻ em, {infants} em bé",
        "",
    ]

    for leg in legs:
        selected = _find_flight_option(
            flight_number=str(leg["flight_number"]),
            date=str(leg["date"]),
            flight_class=str(leg["class"]),
        )
        if not selected:
            return (
                f"Không tìm thấy {leg['label'].lower()} {leg['flight_number']} ngày {leg['date']} "
                f"hạng {leg['class']}. Bạn vui lòng gọi lại search_flight để xác nhận mã chuyến/hạng."
            )

        seats = int(selected.get("available_seats", 0) or 0)
        if required_seats > seats:
            return (
                f"{leg['label']} {selected.get('flight_number')} chỉ còn {seats} ghế, "
                f"không đủ cho {required_seats} hành khách cần ghế."
            )

        base_price = int(selected.get("price", 0) or 0)
        leg_total, breakdown = _calc_leg_total(base_price, adults, seniors, children, infants)
        total_all_legs += leg_total

        dep = selected.get("departure", "--:--")
        arr = selected.get("arrival", "--:--")
        lines.append(
            f"{leg['label']}: {selected.get('flight_number')} · {selected.get('origin')} → {selected.get('destination')} · {selected.get('date')}"
        )
        lines.append(
            f"  Hạng {_class_label(str(selected.get('class', 'economy')))} · {dep} → {arr}"
            f" · Giá cơ sở {_fmt_price(base_price)}"
        )
        lines.extend(breakdown)
        lines.append(f"  👉 Tổng {leg['label'].lower()}: {_fmt_price(leg_total)}")
        lines.append("")

    lines.append(f"✅ Tổng cộng {'khứ hồi' if has_return else '1 chiều'}: {_fmt_price(total_all_legs)}")
    lines.append("Ghi chú: Chưa bao gồm dịch vụ cộng thêm (hành lý/chọn ghế/suất ăn đặc biệt).")

    return "\n".join(lines)


@tool
def lookup_pnr(pnr_code: str) -> str:
    """Tra cứu đặt chỗ/check-in bằng PNR thực tế (6 ký tự) hoặc mã booking (BK_1001)."""
    return lookup_pnr_text(pnr_code)


@tool
def get_customer_profile(customer_id: str) -> str:
    """Tra cứu hồ sơ khách + tóm tắt lịch sử đặt vé và sentiment chat để cá nhân hóa tư vấn."""
    cid = customer_id.strip().upper()
    customer = CUSTOMERS_BY_ID.get(cid)
    if not customer:
        return f"Không tìm thấy khách hàng '{cid}'. Vui lòng kiểm tra lại mã hội viên."

    bookings = [item for item in BOOKINGS if item.get("customer_id", "").upper() == cid]
    bookings.sort(key=lambda item: str(item.get("flight_date", "")), reverse=True)
    confirmed = [item for item in bookings if _norm_text(item.get("booking_status", "")) == "completed"]

    route_counter = Counter(_route_key_from_booking(item) for item in confirmed)
    top_routes = route_counter.most_common(3)

    chats = CHAT_HISTORY_BY_CUSTOMER.get(cid, [])
    sentiments = Counter((_norm_text(item.get("sentiment", "Neutral")) or "neutral") for item in chats)

    lines = [
        "🌸 Hồ sơ khách hàng",
        f"- Khách: {customer.get('full_name', 'N/A')} ({cid})",
        f"- Email: {customer.get('email', 'N/A')}",
        f"- Tổng booking: {len(bookings)} · Completed: {len(confirmed)}",
        (
            f"- Sentiment chat: positive={sentiments.get('positive', 0)}, "
            f"neutral={sentiments.get('neutral', 0)}, negative={sentiments.get('negative', 0)}"
        ),
    ]

    if top_routes:
        route_text = ", ".join(f"{route} ({count})" for route, count in top_routes)
        lines.append(f"- Tuyến thường bay: {route_text}")

    if bookings:
        latest = bookings[0]
        latest_route = _route_key_from_booking(latest)
        lines.append(
            f"- Booking gần nhất: {latest.get('flight_date', '--')} · {latest_route} · "
            f"{latest.get('flight_number', '--')} · {latest.get('class', '--')}"
        )

    lines.append("Bạn muốn tôi gợi ý chuyến bay theo lịch sử gần đây của khách này không?")
    return "\n".join(lines)


@tool
def get_flight_services(flight_number: str) -> str:
    """Lấy danh sách dịch vụ bổ sung cho một chuyến bay Vietnam Airlines."""
    fn = flight_number.strip().upper()

    if not fn.startswith("VN"):
        return (
            f"Chuyến {fn} không thuộc Vietnam Airlines trong dữ liệu hiện tại. "
            "Vui lòng cung cấp mã chuyến bắt đầu bằng 'VN'."
        )

    services = [
        "• Xe lăn sân bay: MIỄN PHÍ (đặt trước 48h)",
        "• Nôi em bé Bassinet: MIỄN PHÍ (theo điều kiện tàu bay)",
        "• Suất ăn đặc biệt: MIỄN PHÍ (đặt trước 24h)",
        "• Chọn ghế trước: 100.000đ – 500.000đ",
        "• Mua thêm hành lý: 300.000đ – 700.000đ/10kg",
    ]

    return (
        f"🛎️ Dịch vụ bổ sung cho chuyến {fn} (Vietnam Airlines):\n\n"
        + "\n".join(services)
        + "\n\n📌 Có thể đặt trên website Vietnam Airlines hoặc tổng đài 1900 1100."
    )


ALL_TOOLS = [
    search_flight,
    calc_fee,
    lookup_pnr,
    get_customer_profile,
    get_flight_services,
]
