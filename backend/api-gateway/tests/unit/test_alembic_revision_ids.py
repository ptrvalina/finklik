"""PostgreSQL often stores alembic_version.version_num as VARCHAR(32)."""

from __future__ import annotations

import re
from pathlib import Path

_VERSIONS = Path(__file__).resolve().parents[2] / "alembic" / "versions"
_MAX_LEN = 32
_REVISION = re.compile(r'^revision:\s*str\s*=\s*["\']([^"\']+)["\']', re.MULTILINE)


def test_all_alembic_revision_ids_fit_varchar32():
    for path in sorted(_VERSIONS.glob("*.py")):
        text = path.read_text(encoding="utf-8")
        m = _REVISION.search(text)
        assert m is not None, f"{path.name}: missing revision assignment"
        rid = m.group(1)
        assert len(rid) <= _MAX_LEN, (
            f"{path.name}: revision {rid!r} is {len(rid)} chars (max {_MAX_LEN})"
        )
