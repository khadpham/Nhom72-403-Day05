from __future__ import annotations

import json
import io
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, SystemMessage
from pydantic import BaseModel, Field

from agent import AgentState, build_graph, initial_state, run_turn
from tools import (
    extract_valid_pnr_from_text,
    get_customer_history_summary,
    infer_search_filters_from_text,
    lookup_pnr_text,
    search_flight_records,
)

try:
    from pypdf import PdfReader  # type: ignore[reportMissingImports]
except Exception:
    PdfReader = None


BASE_DIR = Path(__file__).resolve().parent.parent
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
CHAT_LOG_FILE = LOG_DIR / "chat_history.jsonl"
MAX_UI_ANSWER_CHARS = 1800
THINKING_BLOCK_PATTERN = re.compile(r"<\s*(think|thinking)\s*>.*?<\s*/\s*(think|thinking)\s*>", re.IGNORECASE | re.DOTALL)
THINKING_LINE_PATTERN = re.compile(r"^\s*(thought|reasoning|analysis|scratchpad)\s*:", re.IGNORECASE)
CYRILLIC_TOKEN_PATTERN = re.compile(r"[А-Яа-яЁё]+")
VI_DIACRITIC_PATTERN = re.compile(r"[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]", re.IGNORECASE)
VI_WORD_PATTERN = re.compile(
    r"\b(tôi|toi|muốn|muon|đi|di|vé|ve|ngày|ngay|chuyến|chuyen|hãng|hang|đặt|dat|giúp|giup|xin|vui lòng|vui long|check-in|hạng ghế|hang ghe)\b",
    re.IGNORECASE,
)

APP = FastAPI(title="NEO Backend", version="0.1.0")
GRAPH = build_graph()
SESSIONS: dict[str, AgentState] = {}
SESSION_LANGUAGE: dict[str, str] = {}
SESSION_PROFILE_USER: dict[str, str] = {}

APP.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    user_message: str = Field(min_length=1)
    session_id: str | None = None
    user_id: str | None = None


class ChatResponse(BaseModel):
    answer: str
    session_id: str


class FlightSearchRequest(BaseModel):
    origin: str = Field(min_length=1)
    destination: str = Field(min_length=1)
    date: str | None = None
    max_price: int | None = None
    flight_class: str | None = None
    min_departure_hour: int | None = None
    max_departure_hour: int | None = None
    limit: int = 200


class FlightSearchFromTextRequest(BaseModel):
    user_message: str = Field(min_length=1)
    limit: int = 200


class CheckinPNRRequest(BaseModel):
    pnr_code: str = Field(min_length=4)


class SessionBindRequest(BaseModel):
    user_id: str = Field(min_length=1)
    session_id: str | None = None


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _to_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                text = item.get("text")
                if text:
                    parts.append(str(text))
            else:
                parts.append(str(item))
        return "\n".join(parts).strip()
    return str(content)


def _serialize_messages(messages: list[Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for message in messages:
        out.append(
            {
                "type": getattr(message, "type", "unknown"),
                "content": _to_text(getattr(message, "content", "")),
                "tool_calls": getattr(message, "tool_calls", None),
                "name": getattr(message, "name", None),
            }
        )
    return out


def _extract_last_ai_text(messages: list[Any]) -> str:
    for message in reversed(messages):
        if getattr(message, "type", None) == "ai":
            text = _to_text(getattr(message, "content", ""))
            if text:
                return text
    return "Xin lỗi, tôi chưa có phản hồi phù hợp. Bạn thử diễn đạt lại giúp tôi nhé."


def _sanitize_answer_for_ui(text: str) -> str:
    content = (text or "").replace("\r", "")
    content = THINKING_BLOCK_PATTERN.sub("", content)

    cleaned_lines: list[str] = []
    for line in content.split("\n"):
        if THINKING_LINE_PATTERN.match(line):
            continue
        line = CYRILLIC_TOKEN_PATTERN.sub("", line)
        line = re.sub(r"[ \t]{2,}", " ", line).rstrip()
        cleaned_lines.append(line)

    cleaned = "\n".join(cleaned_lines).strip()
    cleaned = re.sub(r"\s+([,.;:!?])", r"\1", cleaned)
    if len(cleaned) > MAX_UI_ANSWER_CHARS:
        cleaned = cleaned[:MAX_UI_ANSWER_CHARS].rstrip() + "\n\n…(Nội dung đã được rút gọn để hiển thị trong chat)"
    return cleaned


def _detect_language(text: str) -> str:
    content = (text or "").strip()
    if not content:
        return "vi"

    if VI_DIACRITIC_PATTERN.search(content):
        return "vi"
    if VI_WORD_PATTERN.search(content):
        return "vi"
    return "en"


def _fallback_answer_from_error(error: Exception, language: str) -> str:
    lang = "en" if language == "en" else "vi"
    error_text = str(error).lower()

    if "rate limit" in error_text or "429" in error_text:
        if lang == "en":
            return "Sorry, the system is temporarily overloaded due to API rate limits. Please try again in a short while."
        return (
            "Xin lỗi, hệ thống đang quá tải tạm thời do giới hạn API. "
            "Bạn vui lòng thử lại sau vài chục giây nhé."
        )

    if any(keyword in error_text for keyword in ["authentication", "unauthorized", "invalid api key", "401", "403"]):
        if lang == "en":
            return (
                "Sorry, there is an API authentication issue right now. "
                "Please verify your .env keys (GITHUB_TOKEN / OPENAI_API_KEY)."
            )
        return (
            "Xin lỗi, hiện có vấn đề xác thực API. "
            "Bạn vui lòng kiểm tra lại key trong file .env (GITHUB_TOKEN / OPENAI_API_KEY)."
        )

    if lang == "en":
        return (
            "Sorry, the backend is temporarily unavailable. "
            "Please retry in a moment or try a shorter message."
        )
    return (
        "Xin lỗi, backend đang gặp lỗi tạm thời. "
        "Bạn thử gửi lại câu hỏi sau ít phút hoặc diễn đạt ngắn gọn hơn giúp tôi nhé."
    )


def _degraded_warning(language: str) -> str:
    if language == "en":
        return "Running in fallback mode due to temporary API issue."
    return "Đang dùng chế độ dự phòng do lỗi API."


def _normalize_user_id(user_id: str | None) -> str | None:
    normalized = (user_id or "").strip().upper()
    return normalized or None


def _inject_customer_context_if_needed(session_id: str, state: AgentState, user_id: str | None) -> bool:
    normalized_user = _normalize_user_id(user_id)
    if not normalized_user:
        return False

    if SESSION_PROFILE_USER.get(session_id) == normalized_user:
        return True

    summary = get_customer_history_summary(normalized_user)
    if summary:
        state["messages"].append(
            SystemMessage(
                content=(
                    "CUSTOMER_PERSONALIZATION_CONTEXT\n"
                    "Dữ liệu dưới đây là lịch sử khách đã đăng nhập. "
                    "Chỉ dùng để cá nhân hóa tư vấn (ưu tiên tuyến/hạng/giọng văn phù hợp), "
                    "không được bịa thêm dữ liệu ngoài phần này.\n"
                    f"{summary}"
                )
            )
        )
        SESSION_PROFILE_USER[session_id] = normalized_user
        return True

    SESSION_PROFILE_USER[session_id] = normalized_user
    return False


def _run_turn_with_resilience(session_id: str, user_message: str, user_id: str | None) -> tuple[str, bool, str]:
    if session_id not in SESSIONS:
        SESSIONS[session_id] = initial_state()

    state = SESSIONS[session_id]
    if session_id not in SESSION_LANGUAGE:
        SESSION_LANGUAGE[session_id] = _detect_language(user_message)
    session_language = SESSION_LANGUAGE[session_id]

    _inject_customer_context_if_needed(session_id=session_id, state=state, user_id=user_id)

    degraded = False
    error_text: str | None = None

    try:
        next_state = run_turn(GRAPH, state, user_message, language_lock=session_language)
        SESSIONS[session_id] = next_state
        answer = _extract_last_ai_text(next_state["messages"])
    except Exception as error:
        degraded = True
        error_text = str(error)
        answer = _fallback_answer_from_error(error, session_language)
        state["messages"].append(AIMessage(content=answer))
        SESSIONS[session_id] = state
        next_state = state

    safe_answer = _sanitize_answer_for_ui(answer)

    _append_chat_log(
        {
            "timestamp": _utc_now(),
            "session_id": session_id,
            "user_id": user_id,
            "user_message": user_message,
            "assistant_message": safe_answer,
            "messages": _serialize_messages(next_state["messages"]),
            "session_language": session_language,
            "degraded": degraded,
            "error": error_text,
        }
    )

    return safe_answer, degraded, session_language


def _stream_chunks(text: str, chunk_size: int = 24):
    for start in range(0, len(text), chunk_size):
        yield text[start:start + chunk_size]


def _sse(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _append_chat_log(payload: dict[str, Any]) -> None:
    with open(CHAT_LOG_FILE, "a", encoding="utf-8") as file:
        file.write(json.dumps(payload, ensure_ascii=False) + "\n")


def _extract_text_from_pdf_bytes(content: bytes, max_pages: int = 5) -> str:
    if not content or PdfReader is None:
        return ""

    # Tránh parse các file giả PDF/truncated để không phát sinh warning log từ parser.
    if b"%%EOF" not in content[-2048:]:
        return ""

    try:
        reader = PdfReader(io.BytesIO(content))
        chunks: list[str] = []
        for page in reader.pages[:max_pages]:
            text = page.extract_text() or ""
            text = text.strip()
            if text:
                chunks.append(text)
        return "\n".join(chunks).strip()
    except Exception:
        return ""


@APP.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@APP.get("/api/chat")
def chat_get_help() -> dict[str, Any]:
    return {
        "message": "Endpoint /api/chat dùng phương thức POST.",
        "how_to_test": {
            "swagger_ui": "http://127.0.0.1:8000/docs",
            "method": "POST",
            "path": "/api/chat",
            "sample_body": {
                "user_message": "Tìm chuyến Hà Nội đi Đà Nẵng ngày 2026-04-15",
                "session_id": "demo-ui",
                "user_id": "CUST_007",
            },
        },
    }


@APP.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    session_id = (request.session_id or "").strip() or str(uuid4())

    answer, _, _ = _run_turn_with_resilience(
        session_id=session_id,
        user_message=request.user_message,
        user_id=request.user_id,
    )

    return ChatResponse(answer=answer, session_id=session_id)


@APP.post("/api/chat/stream")
def chat_stream(request: ChatRequest):
    session_id = (request.session_id or "").strip() or str(uuid4())

    def event_stream():
        yield _sse({"type": "session", "session_id": session_id})
        yield _sse({"type": "status", "message": "processing"})

        answer, degraded, session_language = _run_turn_with_resilience(
            session_id=session_id,
            user_message=request.user_message,
            user_id=request.user_id,
        )

        if degraded:
            yield _sse({"type": "warning", "message": _degraded_warning(session_language)})

        for chunk in _stream_chunks(answer, chunk_size=24):
            yield _sse({"type": "chunk", "content": chunk})
            time.sleep(0.008)

        yield _sse({"type": "done", "session_id": session_id})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@APP.post("/api/flights/search")
def search_flights_endpoint(request: FlightSearchRequest) -> dict[str, Any]:
    flights = search_flight_records(
        origin=request.origin,
        destination=request.destination,
        date=request.date,
        max_price=request.max_price,
        flight_class=request.flight_class,
        min_departure_hour=request.min_departure_hour,
        max_departure_hour=request.max_departure_hour,
        limit=request.limit,
    )
    return {
        "filters": request.model_dump(),
        "total": len(flights),
        "flights": flights,
    }


@APP.post("/api/flights/from-text")
def search_flights_from_text(request: FlightSearchFromTextRequest) -> dict[str, Any]:
    filters = infer_search_filters_from_text(request.user_message)
    origin = filters.get("origin")
    destination = filters.get("destination")

    if not origin or not destination:
        return {
            "should_prompt_redirect": False,
            "filters": filters,
            "total": 0,
            "flights": [],
        }

    flights = search_flight_records(
        origin=origin,
        destination=destination,
        date=filters.get("date"),
        max_price=filters.get("max_price"),
        flight_class=filters.get("flight_class"),
        min_departure_hour=filters.get("min_departure_hour"),
        max_departure_hour=filters.get("max_departure_hour"),
        limit=request.limit,
    )

    return {
        "should_prompt_redirect": len(flights) > 0,
        "filters": filters,
        "total": len(flights),
        "flights": flights,
    }


@APP.post("/api/session/bind-user")
def bind_user_to_session(request: SessionBindRequest) -> dict[str, Any]:
    session_id = (request.session_id or "").strip() or str(uuid4())
    if session_id not in SESSIONS:
        SESSIONS[session_id] = initial_state()

    state = SESSIONS[session_id]
    context_loaded = _inject_customer_context_if_needed(
        session_id=session_id,
        state=state,
        user_id=request.user_id,
    )
    SESSIONS[session_id] = state

    return {
        "ok": True,
        "session_id": session_id,
        "user_id": _normalize_user_id(request.user_id),
        "context_loaded": context_loaded,
    }


@APP.post("/api/checkin/pnr")
def checkin_by_pnr(request: CheckinPNRRequest) -> dict[str, Any]:
    candidate = extract_valid_pnr_from_text(request.pnr_code)
    if not candidate:
        return {
            "ok": False,
            "message": "Không tìm thấy PNR hợp lệ trong dữ liệu hiện tại.",
        }

    return {
        "ok": True,
        "pnr": candidate,
        "details": lookup_pnr_text(candidate),
    }


@APP.post("/api/checkin/upload")
async def checkin_from_upload(file: UploadFile = File(...)) -> dict[str, Any]:
    filename = (file.filename or "unknown").strip()
    suffix = Path(filename).suffix.lower()
    content = await file.read()

    text_candidates = [filename]
    extraction_method = "filename"

    if suffix == ".pdf":
        pdf_text = _extract_text_from_pdf_bytes(content)
        if pdf_text:
            text_candidates.append(pdf_text)
            extraction_method = "local_pdf_parser"

    candidate = extract_valid_pnr_from_text("\n".join(text_candidates))
    if not candidate:
        return {
            "ok": False,
            "message": (
                "Không trích xuất được PNR hợp lệ từ file. "
                "Vui lòng nhập trực tiếp mã PNR (6 ký tự) hoặc mã booking BK_xxxx."
            ),
            "filename": filename,
            "extraction_method": extraction_method,
            "api_cost": "0 (local parsing)",
            "pdf_parser_available": PdfReader is not None,
        }

    return {
        "ok": True,
        "pnr": candidate,
        "details": lookup_pnr_text(candidate),
        "filename": filename,
        "extraction_method": extraction_method,
        "api_cost": "0 (local parsing)",
        "pdf_parser_available": PdfReader is not None,
    }


@APP.get("/api/history/{session_id}")
def history(session_id: str) -> dict[str, Any]:
    state = SESSIONS.get(session_id)
    if not state:
        return {"session_id": session_id, "messages": []}
    return {"session_id": session_id, "messages": _serialize_messages(state["messages"])}


@APP.delete("/api/history/{session_id}")
def clear_history(session_id: str) -> dict[str, Any]:
    removed = SESSIONS.pop(session_id, None) is not None
    SESSION_LANGUAGE.pop(session_id, None)
    SESSION_PROFILE_USER.pop(session_id, None)
    return {"session_id": session_id, "removed": removed}
