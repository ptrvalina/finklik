"""FSZN integration client powered by Playwright RPA."""

from __future__ import annotations

import os
import random

from app.internal.fszn.rpa import FsznRpaError, call_rpa_script


class FsznClient:
    """Client that submits PU reports via external RPA script."""

    def __init__(self) -> None:
        self.script_path = os.getenv("FSZN_RPA_SCRIPT_PATH", "rpa-scripts/fszn-pu2.js")
        self.credentials = {
            "login": os.getenv("FSZN_PORTAL_LOGIN", ""),
            "password": os.getenv("FSZN_PORTAL_PASSWORD", ""),
            "portal_url": os.getenv("FSZN_PORTAL_URL", "https://portal2.ssf.gov.by"),
        }

    async def SendPu2(self, employee_data: dict) -> tuple[str, str]:
        """Send PU-2 through RPA and return protocol_id + status."""
        xml_data = str(employee_data.get("xml_data") or "<PU2 />")
        try:
            protocol_id = call_rpa_script(
                script_path=self.script_path,
                xml_data=xml_data,
                credentials=self.credentials,
                report_type="pu2",
            )
            return protocol_id, "accepted"
        except FsznRpaError:
            return f"failed-{random.randint(100000, 999999)}", "rejected"

    async def SendPu3(self, period_data: dict) -> tuple[str, str]:
        """Send PU-3 through RPA and return protocol_id + status."""
        xml_data = str(period_data.get("xml_data") or "<PU3 />")
        try:
            protocol_id = call_rpa_script(
                script_path=self.script_path,
                xml_data=xml_data,
                credentials=self.credentials,
                report_type="pu3",
            )
            return protocol_id, "accepted"
        except FsznRpaError:
            return f"failed-{random.randint(100000, 999999)}", "rejected"

    async def CheckReportStatus(self, protocol_id: str) -> str:
        """Check report status; stubbed until dedicated status parser is added."""
        _ = protocol_id
        return random.choice(["pending", "accepted", "rejected"])
