from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.websocket.manager import manager
from app.core.security import decode_access_token
import json

router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
):
    """
    WebSocket соединение для real-time уведомлений.

    Подключение: ws://localhost:8000/ws?token=<access_token>

    События от сервера:
      {"event": "tax_deadline", "data": {"tax": "УСН", "days_left": 7, "amount": 375.00}}
      {"event": "bank_update",  "data": {"balance": 15000.00, "change": -500.00}}
      {"event": "report_status","data": {"report_id": "...", "status": "sent"}}
      {"event": "sync_complete","data": {"synced": 12, "errors": 0}}

    Пинг/понг: клиент отправляет {"type":"ping"}, сервер отвечает {"type":"pong"}
    """
    # Проверяем токен
    try:
        payload = decode_access_token(token)
        org_id = payload.get("org_id", "")
        if not org_id:
            await websocket.close(code=4001)
            return
    except Exception:
        await websocket.close(code=4001)
        return

    await manager.connect(websocket, org_id)

    # Приветственное сообщение
    await websocket.send_json({
        "event": "connected",
        "data": {
            "message": "Соединение установлено",
            "org_id": org_id,
        }
    })

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        manager.disconnect(websocket, org_id)


@router.get("/ws/stats", tags=["system"])
async def websocket_stats():
    return {
        "connected_orgs": manager.connected_orgs,
        "total_connections": manager.total_connections,
    }
