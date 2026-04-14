"""Mitigate server-side request forgery for outbound HTTP fetches."""

import ipaddress
import socket
from urllib.parse import urlparse

from fastapi import HTTPException

from app.core.config import settings


def validate_outbound_http_url(
    url_str: str,
    *,
    invalid: str = "Некорректный URL для исходящего запроса",
    https_required: str = "Для production разрешён только https",
    resolve_failed: str = "Не удалось разрешить хост",
    private_literal: str = "Приватные и локальные адреса запрещены",
    private_resolved: str = "Хост резолвится в приватную или локальную сеть",
) -> None:
    parsed = urlparse(url_str.strip())
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise HTTPException(status_code=400, detail=invalid)

    if parsed.scheme != "https" and not settings.DEBUG:
        raise HTTPException(status_code=400, detail=https_required)

    host = parsed.hostname
    port = parsed.port or (443 if parsed.scheme == "https" else 80)

    try:
        ip = ipaddress.ip_address(host)
        bad_net = (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
        )
        if bad_net and not settings.DEBUG:
            raise HTTPException(status_code=400, detail=private_literal)
        return
    except ValueError:
        pass

    try:
        infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    except OSError:
        raise HTTPException(status_code=400, detail=resolve_failed)

    for info in infos:
        addr = info[4][0]
        try:
            ip = ipaddress.ip_address(addr)
        except ValueError:
            continue
        bad_net = (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
        )
        if bad_net and not settings.DEBUG:
            raise HTTPException(status_code=400, detail=private_resolved)
