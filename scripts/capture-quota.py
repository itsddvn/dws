"""mitmproxy addon for Devin quota endpoint discovery.

Run:
  mitmdump -s scripts/capture-quota.py --set block_global=false \
    --listen-host 127.0.0.1 --listen-port 8080

This script prints redacted request/response metadata for likely quota calls.
It intentionally avoids logging Authorization, Cookie, and raw credentials.
"""

from __future__ import annotations

import json
import re
from typing import Any

from mitmproxy import http


JWT_RE = re.compile(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+")
SECRET_KEYS = {
    "authorization",
    "cookie",
    "set-cookie",
    "windsurf_api_key",
    "access_token",
    "refresh_token",
}
INTERESTING_TERMS = (
    "quota",
    "usage",
    "credit",
    "acu",
    "plan",
    "subscription",
)


def redact_value(value: Any) -> Any:
    if isinstance(value, str):
        return JWT_RE.sub("[REDACTED_JWT]", value)
    if isinstance(value, list):
        return [redact_value(item) for item in value]
    if isinstance(value, dict):
        return {
            key: "[REDACTED]" if key.lower() in SECRET_KEYS else redact_value(val)
            for key, val in value.items()
        }
    return value


def looks_interesting(flow: http.HTTPFlow) -> bool:
    target = f"{flow.request.pretty_host}{flow.request.path}".lower()
    if any(term in target for term in INTERESTING_TERMS):
        return True
    text = flow.response.get_text(strict=False).lower() if flow.response else ""
    return any(term in text for term in INTERESTING_TERMS)


def response(flow: http.HTTPFlow) -> None:
    if not flow.response or not looks_interesting(flow):
        return

    body: Any = flow.response.get_text(strict=False)
    content_type = flow.response.headers.get("content-type", "")
    if "json" in content_type:
        try:
            body = json.loads(body)
        except json.JSONDecodeError:
            pass

    record = {
        "request": {
            "method": flow.request.method,
            "host": flow.request.pretty_host,
            "path": flow.request.path,
            "content_type": flow.request.headers.get("content-type", ""),
        },
        "response": {
            "status_code": flow.response.status_code,
            "content_type": content_type,
            "body": redact_value(body),
        },
    }
    print(json.dumps(record, ensure_ascii=True, indent=2))
