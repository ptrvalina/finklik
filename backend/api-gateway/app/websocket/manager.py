"""
WebSocket менеджер для real-time уведомлений.

События:
  tax_deadline   — приближается срок уплаты налога
  bank_update    — изменение баланса
  report_status  — статус отправки отчёта
  sync_complete  — синхронизация с 1С завершена
"""
from fastapi import WebSocket
from typing import Any
import json
import asyncio


class ConnectionManager:
    def __init__(self):
        # org_id -> список активных соединений
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, org_id: str):
        await websocket.accept()
        if org_id not in self._connections:
            self._connections[org_id] = []
        self._connections[org_id].append(websocket)

    def disconnect(self, websocket: WebSocket, org_id: str):
        if org_id in self._connections:
            try:
                self._connections[org_id].remove(websocket)
            except ValueError:
                pass
            if not self._connections[org_id]:
                del self._connections[org_id]

    async def send_to_org(self, org_id: str, event: str, data: Any):
        """Отправить событие всем подключениям организации."""
        message = json.dumps({"event": event, "data": data}, default=str)
        if org_id not in self._connections:
            return

        dead = []
        for ws in self._connections[org_id]:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)

        for ws in dead:
            self.disconnect(ws, org_id)

    async def broadcast(self, event: str, data: Any):
        """Отправить всем подключённым клиентам."""
        for org_id in list(self._connections.keys()):
            await self.send_to_org(org_id, event, data)

    @property
    def connected_orgs(self) -> int:
        return len(self._connections)

    @property
    def total_connections(self) -> int:
        return sum(len(v) for v in self._connections.values())


manager = ConnectionManager()
