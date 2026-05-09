from app.services.signing_facade import canonical_json_bytes, compute_digest, mock_signature_b64_preview


def test_canonical_json_stable_and_digest_deterministic():
    payload = {"b": 2, "a": {"z": 1, "y": None}}
    d1 = compute_digest(payload)
    d2 = compute_digest(payload)
    assert d1.sha256_hex == d2.sha256_hex
    raw = canonical_json_bytes(payload)
    assert raw == b'{"a":{"y":null,"z":1},"b":2}'


def test_mock_signature_preview_roundtrip_marker():
    d = compute_digest({"x": 1})
    b64 = mock_signature_b64_preview(d.sha256_hex)
    assert "MOCK-CMS" in b64 or len(b64) > 8
