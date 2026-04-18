"""Roundtrip for organization LLM key encryption."""

from app.services.org_llm_crypto import decrypt_org_llm_api_key, encrypt_org_llm_api_key


def test_org_llm_encrypt_roundtrip():
    plain = "sk-test-key-12345678901234567890"
    enc = encrypt_org_llm_api_key(plain)
    assert enc != plain
    assert decrypt_org_llm_api_key(enc) == plain
