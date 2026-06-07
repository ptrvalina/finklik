"""Проверка подписи к document_hash (SHA-256 hex). Model A: клиент присылает подпись + опционально PEM."""

from __future__ import annotations

import base64
import binascii

from cryptography import x509
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec, padding, rsa, utils


def _b64decode_strict(data: bytes) -> bytes:
    try:
        return base64.standard_b64decode(data, validate=True)
    except TypeError:
        return base64.standard_b64decode(data)


def _mock_sig_valid(signature_b64: str, document_hash_hex: str) -> bool:
    try:
        raw = _b64decode_strict(signature_b64.encode("ascii"))
        text = raw.decode("ascii", errors="ignore")
        return text == f"MOCK-CMS:{document_hash_hex}"
    except (binascii.Error, ValueError):
        return False


def verify_signature_against_hash(
    *,
    document_hash_hex: str,
    signature_b64: str,
    certificate_pem: str | None,
) -> tuple[bool, str | None]:
    """Возвращает (ok, reason)."""
    sig = signature_b64.strip()
    if not sig:
        return False, "empty_signature"

    if _mock_sig_valid(sig, document_hash_hex):
        return True, None

    if not certificate_pem or not certificate_pem.strip():
        return False, "certificate_required_for_non_mock_signature"

    try:
        digest = bytes.fromhex(document_hash_hex)
    except ValueError:
        return False, "invalid_document_hash_hex"

    if len(digest) != 32:
        return False, "document_hash_must_be_sha256"

    try:
        sig_bytes = _b64decode_strict(sig.encode("ascii"))
    except (binascii.Error, ValueError):
        return False, "invalid_signature_base64"

    try:
        cert = x509.load_pem_x509_certificate(certificate_pem.strip().encode("utf-8"))
    except ValueError:
        return False, "invalid_certificate_pem"

    pubkey = cert.public_key()

    try:
        if isinstance(pubkey, rsa.RSAPublicKey):
            pubkey.verify(sig_bytes, digest, padding.PKCS1v15(), utils.Prehashed(hashes.SHA256()))
        elif isinstance(pubkey, ec.EllipticCurvePublicKey):
            pubkey.verify(sig_bytes, digest, ec.ECDSA(utils.Prehashed(hashes.SHA256())))
        else:
            return False, "unsupported_public_key_type"
    except InvalidSignature:
        return False, "signature_verification_failed"

    return True, None
