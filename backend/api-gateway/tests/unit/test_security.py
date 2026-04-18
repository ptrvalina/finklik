"""Unit tests for security module."""
import sys

import pytest


@pytest.mark.skipif(
    sys.version_info >= (3, 14),
    reason="bcrypt/passlib unstable on Python 3.14+ — CI uses 3.11 (DEVELOPER_GUIDE).",
)
class TestPasswordHashing:
    def test_hash_and_verify(self):
        from app.core.security import hash_password, verify_password
        hashed = hash_password("TestPass123")
        assert hashed != "TestPass123"
        assert hashed.startswith(("$2a$", "$2b$", "$2y$"))
        assert verify_password("TestPass123", hashed) is True
        assert verify_password("WrongPass", hashed) is False


class TestJWT:
    def test_create_and_decode(self):
        from app.core.security import create_access_token, decode_access_token
        token = create_access_token("user-123", "org-456", "owner")
        assert isinstance(token, str)
        assert len(token) > 20
        payload = decode_access_token(token)
        assert payload["sub"] == "user-123"
        assert payload["org_id"] == "org-456"
        assert payload["role"] == "owner"

    def test_invalid_jwt(self):
        from fastapi import HTTPException
        from app.core.security import decode_access_token
        with pytest.raises(HTTPException) as exc:
            decode_access_token("invalid.token.here")
        assert exc.value.status_code == 401


class TestEncryption:
    def test_roundtrip(self):
        from app.security.middleware import DataEncryptor
        enc = DataEncryptor("test_secret_key_12345")
        original = "Иванов Иван Иванович"
        encrypted = enc.encrypt(original)
        assert encrypted != original
        assert enc.decrypt(encrypted) == original

    def test_empty_string(self):
        from app.security.middleware import DataEncryptor
        enc = DataEncryptor("key")
        assert enc.encrypt("") == ""
        assert enc.decrypt("") == ""


class TestTTNExtractor:
    def test_extract_basic(self):
        import sys, os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "ai", "inference", "app"))
        try:
            from ttn_extractor import extract_ttn_data
        except ImportError:
            pytest.skip("ttn_extractor not importable")

        text = """
        ТОВАРНО-ТРАНСПОРТНАЯ НАКЛАДНАЯ № ТТН-1234
        Грузоотправитель: ОАО Молокозавод
        Дата: 01.04.2026
        1  Молоко  л  100  2,50  250,00
        Итого: 250,00
        """
        result = extract_ttn_data(text)
        assert result.doc_number == "ТТН-1234"
        assert result.confidence > 0

    def test_unp_validation(self):
        import sys, os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "ai", "inference", "app"))
        try:
            from ttn_extractor import validate_unp
        except ImportError:
            pytest.skip("ttn_extractor not importable")
        assert validate_unp("123") is False
        assert validate_unp("") is False
