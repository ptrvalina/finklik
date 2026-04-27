"""Unit tests for CORS parsing and validation."""

import pytest

from app.core.cors import compile_cors_origin_regex, parse_cors_origins_env, validate_browser_origin


class TestValidateBrowserOrigin:
    def test_ok_http_localhost(self):
        assert validate_browser_origin("http://localhost:5173") == "http://localhost:5173"

    def test_trailing_slash_normalized(self):
        assert validate_browser_origin("https://example.com/") == "https://example.com"

    def test_rejects_wildcard(self):
        with pytest.raises(ValueError, match="недопустим"):
            validate_browser_origin("*")

    def test_rejects_path(self):
        with pytest.raises(ValueError, match="path"):
            validate_browser_origin("https://evil.com/foo")


class TestParseCorsOriginsEnv:
    def test_csv(self):
        assert parse_cors_origins_env("https://a.com, https://b.com ") == ["https://a.com", "https://b.com"]

    def test_json_array(self):
        raw = '["http://localhost:5173","http://127.0.0.1:5173"]'
        assert parse_cors_origins_env(raw) == ["http://localhost:5173", "http://127.0.0.1:5173"]

    def test_dedupe(self):
        assert parse_cors_origins_env("https://x.by,https://x.by") == ["https://x.by"]


class TestCompileCorsRegex:
    def test_empty_off(self):
        assert compile_cors_origin_regex("") is None
        assert compile_cors_origin_regex("   ") is None

    def test_invalid_pattern(self):
        with pytest.raises(ValueError, match="Некорректный"):
            compile_cors_origin_regex("[invalid")
