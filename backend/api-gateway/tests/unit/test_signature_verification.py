import base64

import pytest

from app.services.signature_verification import verify_signature_against_hash


def test_mock_signature_valid():
    h = "a" * 64
    sig = base64.standard_b64encode(f"MOCK-CMS:{h}".encode()).decode()
    ok, reason = verify_signature_against_hash(document_hash_hex=h, signature_b64=sig, certificate_pem=None)
    assert ok is True
    assert reason is None


def test_mock_signature_wrong_hash():
    h = "a" * 64
    sig = base64.standard_b64encode(f"MOCK-CMS:{'b' * 64}".encode()).decode()
    ok, reason = verify_signature_against_hash(document_hash_hex=h, signature_b64=sig, certificate_pem=None)
    assert ok is False


def test_empty_signature_rejected():
    ok, reason = verify_signature_against_hash(document_hash_hex="a" * 64, signature_b64="", certificate_pem=None)
    assert ok is False
    assert reason == "empty_signature"


def test_non_mock_requires_certificate():
    ok, reason = verify_signature_against_hash(
        document_hash_hex="a" * 64,
        signature_b64=base64.standard_b64encode(b"not-a-mock").decode(),
        certificate_pem=None,
    )
    assert ok is False
    assert reason == "certificate_required_for_non_mock_signature"
