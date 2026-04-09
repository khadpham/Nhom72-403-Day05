from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Annotated, Any, cast
from typing_extensions import TypedDict

from dotenv import load_dotenv
from langchain_core.messages import AIMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from openai import (
    APIConnectionError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    InternalServerError,
    PermissionDeniedError,
    RateLimitError,
)

from tools import ALL_TOOLS


BASE_DIR = Path(__file__).resolve().parent.parent
SYSTEM_PROMPT_PATH = Path(__file__).resolve().parent / "system_prompt.txt"


def load_system_prompt() -> str:
    with open(SYSTEM_PROMPT_PATH, "r", encoding="utf-8") as file:
        return file.read().strip()


load_dotenv(BASE_DIR / ".env")
SYSTEM_PROMPT = load_system_prompt()


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]


JAILBREAK_PATTERN = re.compile(
    r"\b(system prompt|override|bypass|bỏ qua|ignore all|disregard all|tiết lộ|secret|hidden instructions)\b",
    re.IGNORECASE,
)
LANGUAGE_LOCK_PATTERN = re.compile(r"LANGUAGE_LOCK\s*:\s*(vi|en)", re.IGNORECASE)


def is_jailbreak_attempt(text: str) -> bool:
    return bool(JAILBREAK_PATTERN.search(text or ""))


def _normalize_language(language: str | None) -> str:
    return "en" if (language or "").strip().lower().startswith("en") else "vi"


def _extract_language_lock(messages: list[Any]) -> str:
    for message in reversed(messages):
        if isinstance(message, SystemMessage):
            content = str(getattr(message, "content", "") or "")
            match = LANGUAGE_LOCK_PATTERN.search(content)
            if match:
                return _normalize_language(match.group(1))
    return "vi"


def _build_language_lock_message(language: str) -> SystemMessage:
    lang = _normalize_language(language)
    if lang == "en":
        return SystemMessage(
            content=(
                "LANGUAGE_LOCK:en\n"
                "Session language is locked to English based on the first user message. "
                "All assistant replies MUST be in English only. Do not mix languages."
            )
        )

    return SystemMessage(
        content=(
            "LANGUAGE_LOCK:vi\n"
            "Ngôn ngữ phiên đã khóa là tiếng Việt theo tin nhắn đầu tiên của người dùng. "
            "Mọi câu trả lời phải dùng tiếng Việt duy nhất, không trộn ngôn ngữ khác."
        )
    )


def refusal_message(language: str = "vi") -> AIMessage:
    lang = _normalize_language(language)
    if lang == "en":
        return AIMessage(
            content=(
                "Sorry, I can’t help with that request. "
                "If you need help with flights, check-in, or onboard services, I’m ready to assist."
            )
        )

    return AIMessage(
        content=(
            "Xin lỗi, tôi không thể hỗ trợ yêu cầu này. "
            "Nếu bạn cần hỗ trợ về vé máy bay, check-in hoặc dịch vụ chuyến bay, tôi sẵn sàng giúp ngay."
        )
    )


def temporary_error_message(language: str = "vi") -> AIMessage:
    lang = _normalize_language(language)
    if lang == "en":
        return AIMessage(
            content=(
                "Sorry, the system hit a temporary processing issue. "
                "Please try again in a moment or rephrase your request."
            )
        )

    return AIMessage(
        content=(
            "Xin lỗi, hệ thống đang gặp lỗi xử lý tạm thời. "
            "Bạn vui lòng thử lại sau ít phút hoặc đổi cách diễn đạt giúp tôi nhé."
        )
    )


def overloaded_message(language: str = "vi") -> AIMessage:
    lang = _normalize_language(language)
    if lang == "en":
        return AIMessage(
            content=(
                "Sorry, the AI service is currently busy or temporarily rate-limited. "
                "Please try again shortly."
            )
        )

    return AIMessage(
        content=(
            "Xin lỗi, hệ thống AI đang bận hoặc vượt hạn mức tạm thời. "
            "Bạn thử lại sau ít phút nhé. Nếu bạn đã cấu hình OPENAI_API_KEY, tôi sẽ tự chuyển sang key dự phòng."
        )
    )


def _is_content_filter_error(error: Exception) -> bool:
    text = str(error).lower()
    return "content_filter" in text or "jailbreak" in text


def _build_provider(
    provider_name: str,
    model: str,
    api_key: str,
    base_url: str | None = None,
) -> dict[str, Any]:
    def get_api_key() -> str:
        return api_key

    kwargs: dict[str, Any] = {
        "model": model,
        "api_key": get_api_key,
        "temperature": 0.2,
    }
    if base_url:
        kwargs["base_url"] = base_url

    llm = ChatOpenAI(**kwargs)
    return {
        "name": provider_name,
        "llm_with_tools": llm.bind_tools(ALL_TOOLS),
    }


def _build_providers() -> list[dict[str, Any]]:
    github_token = os.getenv("GITHUB_TOKEN", "").strip()
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    github_model = os.getenv("GITHUB_MODEL", "gpt-5-nano").strip() or "gpt-5-nano"
    openai_model = os.getenv("OPENAI_MODEL", "gpt-5-nano").strip() or "gpt-5-nano"
    openai_fallback_model = os.getenv("OPENAI_FALLBACK_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"

    providers: list[dict[str, Any]] = []

    if github_token:
        providers.append(
            _build_provider(
                provider_name="github",
                model=github_model,
                api_key=github_token,
                base_url="https://models.inference.ai.azure.com",
            )
        )

    if openai_key:
        providers.append(
            _build_provider(
                provider_name="openai",
                model=openai_model,
                api_key=openai_key,
            )
        )
        if openai_fallback_model != openai_model:
            providers.append(
                _build_provider(
                    provider_name="openai_fallback",
                    model=openai_fallback_model,
                    api_key=openai_key,
                )
            )

    if not providers:
        raise RuntimeError("Missing API key. Please set GITHUB_TOKEN or OPENAI_API_KEY in .env")

    return providers


PROVIDERS = _build_providers()
_ACTIVE_PROVIDER_INDEX = 0


_RETRIABLE_PROVIDER_ERRORS = (
    AuthenticationError,
    PermissionDeniedError,
    RateLimitError,
    APIConnectionError,
    APITimeoutError,
    InternalServerError,
)


def _invoke_with_provider_fallback(messages: list[Any]):
    global _ACTIVE_PROVIDER_INDEX

    # Ưu tiên provider đã thành công gần nhất.
    order = [_ACTIVE_PROVIDER_INDEX] + [idx for idx in range(len(PROVIDERS)) if idx != _ACTIVE_PROVIDER_INDEX]
    errors: list[str] = []

    for provider_index in order:
        provider = PROVIDERS[provider_index]
        provider_name = provider["name"]
        llm_with_tools = provider["llm_with_tools"]

        try:
            response = llm_with_tools.invoke(messages)
            _ACTIVE_PROVIDER_INDEX = provider_index
            return response
        except BadRequestError as error:
            # Content filter/jailbreak: không thử provider khác để giữ hành vi an toàn nhất quán.
            if _is_content_filter_error(error):
                raise
            print(f"[agent] provider={provider_name} bad_request -> try next: {error}")
            errors.append(f"{provider_name}: {error}")
            # Bad request kiểu schema/model mismatch vẫn có thể thử provider tiếp theo.
            continue
        except _RETRIABLE_PROVIDER_ERRORS as error:
            print(f"[agent] provider={provider_name} retriable_error -> try next: {error}")
            errors.append(f"{provider_name}: {error}")
            continue
        except Exception as error:
            # Phòng trường hợp lỗi ngoài dự kiến ở 1 provider; thử provider còn lại nếu có.
            print(f"[agent] provider={provider_name} unexpected_error -> try next: {error}")
            errors.append(f"{provider_name}: {error}")
            continue

    raise RuntimeError("All providers failed: " + " | ".join(errors))


def agent_node(state: AgentState) -> dict:
    messages = state["messages"]
    if not messages or not isinstance(messages[0], SystemMessage):
        messages = [SystemMessage(content=SYSTEM_PROMPT)] + messages

    language = _extract_language_lock(messages)

    latest_user_text = ""
    for message in reversed(messages):
        if getattr(message, "type", None) == "human":
            latest_user_text = str(getattr(message, "content", "") or "")
            break

    if latest_user_text and is_jailbreak_attempt(latest_user_text):
        return {"messages": [refusal_message(language)]}

    try:
        response = _invoke_with_provider_fallback(messages)
    except BadRequestError as error:
        if _is_content_filter_error(error):
            return {"messages": [refusal_message(language)]}
        return {"messages": [temporary_error_message(language)]}
    except Exception:
        return {"messages": [overloaded_message(language)]}

    return {"messages": [response]}


def build_graph():
    builder = StateGraph(AgentState)
    builder.add_node("agent", agent_node)
    builder.add_node("tools", ToolNode(ALL_TOOLS))

    builder.add_edge(START, "agent")
    builder.add_conditional_edges("agent", tools_condition, {"tools": "tools", END: END})
    builder.add_edge("tools", "agent")

    return builder.compile()


def initial_state() -> AgentState:
    return {"messages": [SystemMessage(content=SYSTEM_PROMPT)]}


def run_turn(graph, state: AgentState, user_message: str, language_lock: str | None = None) -> AgentState:
    if language_lock:
        has_lock = any(
            isinstance(msg, SystemMessage)
            and LANGUAGE_LOCK_PATTERN.search(str(getattr(msg, "content", "") or ""))
            for msg in state["messages"]
        )
        if not has_lock:
            state["messages"].append(_build_language_lock_message(language_lock))

    state["messages"].append(("human", user_message))
    result = graph.invoke(state)
    return cast(AgentState, result)
