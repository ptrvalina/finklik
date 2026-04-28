"""FSZN RPA bridge for Playwright scripts."""

from __future__ import annotations

import base64
import json
import os
import subprocess
from pathlib import Path
import structlog


class FsznRpaError(RuntimeError):
    """Raised when FSZN RPA script invocation fails."""


def _resolve_script_path(script_path: str) -> Path:
    candidate = Path(script_path)
    if candidate.is_file():
        return candidate

    # Resolve against api-gateway root and repository root.
    here = Path(__file__).resolve()
    api_gateway_root = here.parents[3]
    repo_root = here.parents[5]
    alt1 = api_gateway_root / script_path
    alt2 = repo_root / script_path
    if alt1.is_file():
        return alt1
    if alt2.is_file():
        return alt2
    return candidate


def _decode_payload(raw_out: str) -> dict:
    try:
        return json.loads(raw_out)
    except json.JSONDecodeError as exc:
        raise FsznRpaError(f"RPA script returned non-JSON output: {raw_out[:500]}") from exc


def call_rpa_script(script_path: str, xml_data: str, credentials: dict, report_type: str = "pu2") -> str:
    """Call Playwright RPA script and return protocol ID.

    Parameters:
        script_path: Path to the Node.js Playwright script.
        xml_data: XML payload to send.
        credentials: Portal credentials map (login/password/portal_url).
        report_type: FSZN report type, e.g. "pu2" or "pu3".

    Returns:
        Protocol ID returned by the portal response.
    """
    if not xml_data or not xml_data.strip():
        raise FsznRpaError("xml_data is empty")

    script = _resolve_script_path(script_path)
    if not script.is_file():
        raise FsznRpaError(f"rpa script not found: {script}")

    env = os.environ.copy()
    env["FSZN_PORTAL_LOGIN"] = str(credentials.get("login", ""))
    env["FSZN_PORTAL_PASSWORD"] = str(credentials.get("password", ""))
    if credentials.get("portal_url"):
        env["FSZN_PORTAL_URL"] = str(credentials["portal_url"])

    xml_b64 = base64.b64encode(xml_data.encode("utf-8")).decode("ascii")

    log = structlog.get_logger().bind(component="fszn_rpa", report_type=report_type)

    last_error: Exception | None = None
    for attempt in range(1, 3):
        completed = subprocess.run(
            ["node", str(script), xml_b64, report_type],
            capture_output=True,
            text=True,
            env=env,
            check=False,
            timeout=240,
        )
        raw_out = (completed.stdout or "").strip()
        raw_err = (completed.stderr or "").strip()
        if not raw_out:
            last_error = FsznRpaError(f"RPA script returned empty output; stderr={raw_err!r}")
            log.warning("fszn_rpa_empty_output", attempt=attempt, return_code=completed.returncode, stderr=raw_err[:500])
            continue

        payload = _decode_payload(raw_out)
        if completed.returncode != 0 or not payload.get("ok"):
            reason = payload.get("error") or payload.get("code") or raw_err or "RPA execution failed"
            last_error = FsznRpaError(str(reason))
            log.warning(
                "fszn_rpa_failed_attempt",
                attempt=attempt,
                return_code=completed.returncode,
                reason=str(reason),
                protocol_id=payload.get("protocol_id"),
            )
            continue

        protocol_id = payload.get("protocol_id")
        if not protocol_id:
            last_error = FsznRpaError("RPA response misses protocol_id")
            continue
        log.info("fszn_rpa_success", attempt=attempt, protocol_id=str(protocol_id))
        return str(protocol_id)

    raise FsznRpaError(str(last_error) if last_error else "RPA execution failed")
