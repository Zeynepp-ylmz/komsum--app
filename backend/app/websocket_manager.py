from collections import defaultdict
from typing import DefaultDict, List

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: DefaultDict[int, List[WebSocket]] = defaultdict(list)

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections[user_id].append(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        connections = self.active_connections.get(user_id)
        if not connections:
            return

        try:
            connections.remove(websocket)
        except ValueError:
            return

        if not connections:
            self.active_connections.pop(user_id, None)

    async def send_to_user(self, user_id: int, payload: dict) -> None:
        connections = list(self.active_connections.get(user_id, []))
        stale_connections: List[WebSocket] = []

        for connection in connections:
            try:
                await connection.send_json(payload)
            except Exception:
                stale_connections.append(connection)

        for connection in stale_connections:
            self.disconnect(user_id, connection)


manager = ConnectionManager()
