import hashlib

from app.api.v1.endpoints import report_submission as rs


def _bucket(submission_id: str) -> float:
    h = int(hashlib.sha256(submission_id.encode()).hexdigest(), 16)
    return (h % 10_000) / 10_000.0


def test_mock_portal_accepts_rate_zero_always_true():
    assert rs._mock_portal_accepts("any-uuid-here", 0.0) is True


def test_mock_portal_accepts_rate_one_always_false():
    assert rs._mock_portal_accepts("any-uuid-here", 1.0) is False


def test_mock_portal_accepts_deterministic():
    sid = "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee"
    b = _bucket(sid)
    assert rs._mock_portal_accepts(sid, b) is True
    rr_reject = min(1.0, b + 0.001)
    assert rs._mock_portal_accepts(sid, rr_reject) is False
