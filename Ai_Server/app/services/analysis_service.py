from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from typing import Any


def _normalize_text(value: str) -> str:
    return value.strip() if value else ""


def _build_summary(commit: dict) -> tuple[str, list[dict[str, Any]], int, int]:
    message = commit.get("commit", {}).get("message", "")
    files = commit.get("files", [])

    additions = sum(file.get("additions", 0) for file in files)
    deletions = sum(file.get("deletions", 0) for file in files)

    return message, files, additions, deletions


def _local_score(message: str, files: list[dict[str, Any]], additions: int) -> tuple[int, str]:
    score = 0

    lowered_message = message.lower()

    if any(keyword in lowered_message for keyword in ("fix", "bug", "patch")):
        score += 15

    if any(keyword in lowered_message for keyword in ("feature", "add", "implement")):
        score += 10

    if additions > 20:
        score += 10

    if len(files) > 3:
        score += 5

    if score >= 20:
        result = "good"
    elif score >= 10:
        result = "needs-review"
    else:
        result = "needs-improvement"

    return score, result


def _build_prompt(commit: dict, local_score: int, local_result: str) -> str:
    message = _normalize_text(commit.get("commit", {}).get("message", ""))
    files = commit.get("files", [])

    file_lines = []
    for file in files:
        filename = file.get("filename") or file.get("path") or "unknown-file"
        additions = file.get("additions", 0)
        deletions = file.get("deletions", 0)
        patch = file.get("patch") or ""
        snippet = patch[:1200]
        file_lines.append(
            f"- {filename} (+{additions} / -{deletions})\n"
            f"  Patch: {snippet}"
        )

    file_block = "\n".join(file_lines) if file_lines else "- No file details were provided."

    return (
        "You are a senior AI code reviewer for commit analysis.\n"
        "Review the commit and produce a concise JSON response with these keys:\n"
        "score (0-100 integer), verdict, summary, strengths, risks, suggestions.\n"
        "The score should reflect code quality, risk, and change size.\n\n"
        f"Commit message: {message or 'No commit message provided.'}\n"
        f"Local heuristic score: {local_score}\n"
        f"Local heuristic result: {local_result}\n\n"
        f"Changed files:\n{file_block}\n\n"
        "Return JSON only."
    )


def _extract_json_from_text(text: str) -> dict[str, Any] | None:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            return None

    return None


def _call_llm(prompt: str) -> tuple[dict[str, Any] | None, str | None, str | None]:
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if gemini_api_key:
        provider = "gemini"
        model_name = os.getenv("MODEL") or "gemini-2.5-flash"
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_api_key)
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            content = response.text
            llm_json = _extract_json_from_text(content)
            if llm_json is not None:
                return llm_json, provider, model_name
            return {"summary": content}, provider, model_name
        except Exception as e:
            error_msg = f"Gemini API Error: {str(e)}"
            print(error_msg)
            return {"summary": error_msg}, provider, model_name

    provider = os.getenv("LLM_PROVIDER", "openai").lower()
    model = os.getenv("LLM_MODEL") or os.getenv("MODEL") or "gpt-4o-mini"
    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("LLM_API_KEY") or ""

    if provider == "llama":
        base_url = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
    else:
        base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")

    if not api_key and provider != "llama":
        return None, provider, model

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are an expert code review assistant."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }

    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            **({"Authorization": f"Bearer {api_key}"} if api_key else {}),
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw_data = response.read().decode("utf-8")
        parsed = json.loads(raw_data)
        content = parsed["choices"][0]["message"]["content"]
        llm_json = _extract_json_from_text(content)
        if llm_json is not None:
            return llm_json, provider, model
        return {"summary": content}, provider, model
    except (urllib.error.URLError, urllib.error.HTTPError, KeyError, IndexError, json.JSONDecodeError):
        return None, provider, model


def analyze_commit_logic(commit: dict):
    message, files, additions, deletions = _build_summary(commit)
    local_score, local_result = _local_score(message, files, additions)
    prompt = _build_prompt(commit, local_score, local_result)

    llm_review, provider, model = _call_llm(prompt)

    ai_score = local_score
    ai_result = local_result
    ai_review = ""

    if llm_review:
        ai_review = str(
            llm_review.get("summary")
            or llm_review.get("review")
            or llm_review.get("verdict")
            or "AI review generated successfully."
        )

        parsed_score = llm_review.get("score")
        if isinstance(parsed_score, int):
            ai_score = max(0, min(100, parsed_score))

        parsed_result = llm_review.get("verdict")
        if isinstance(parsed_result, str) and parsed_result.strip():
            ai_result = parsed_result.strip()
    else:
        ai_review = (
            "LLM review unavailable, so the response was generated using local heuristics only. "
            "Configure OPENAI_API_KEY with LLM_BASE_URL or set LLM_PROVIDER=llama for a local OpenAI-compatible server."
        )

    return {
        "score": ai_score,
        "result": ai_result,
        "files_changed": len(files),
        "additions": additions,
        "deletions": deletions,
        "ai_review": ai_review,
        "prompt": prompt,
        "provider": provider,
        "model": model,
        "raw_llm_output": llm_review,
    }