from app.services.submission_portal import parse_portal_response_json


def test_parse_portal_json_accepted_with_reference():
    r = parse_portal_response_json({"accepted": True, "portal_reference": "EXT-1"})
    assert r.accepted is True
    assert r.portal_reference == "EXT-1"


def test_parse_portal_json_rejected_with_reason():
    r = parse_portal_response_json({"accepted": False, "reason": "schema"})
    assert r.accepted is False
    assert r.reason == "schema"


def test_parse_portal_json_ok_alias():
    r = parse_portal_response_json({"ok": True})
    assert r.accepted is True
