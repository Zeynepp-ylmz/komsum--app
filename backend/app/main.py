from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from app.database import Base, engine
from app.routers import auth, users, ads, messages, interactions, admin, notifications
from app.auth import get_user_from_access_token
from app.database import SessionLocal
from app.rate_limiter import limiter
from app.websocket_manager import manager
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import inspect, text

# Veritabanı tablolarını oluştur
Base.metadata.create_all(bind=engine)

inspector = inspect(engine)
if "kullanicilar" in inspector.get_table_names():
    user_columns = {column["name"] for column in inspector.get_columns("kullanicilar")}
    if "pending_email" not in user_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE kullanicilar ADD COLUMN pending_email VARCHAR"))

inspector = inspect(engine)
if "mahalleler" in inspector.get_table_names():
    mahalle_columns = {column["name"] for column in inspector.get_columns("mahalleler")}
    if "ilce_id" not in mahalle_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE mahalleler ADD COLUMN ilce_id INTEGER"))

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Komşum Platformu API")

# Rate Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Ayarları (Telefondan erişim için şart!)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Her yerden erişime izin ver (Güvenlik için prod'da kısıtlanmalı)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Statik Dosyalar
app.mount("/static", StaticFiles(directory="static"), name="static")

# Routerları Ekle
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(ads.router)
app.include_router(messages.router)
app.include_router(interactions.router)
app.include_router(admin.router)
app.include_router(notifications.router)


@app.middleware("http")
async def dispatch_websocket_events(request, call_next):
    response = await call_next(request)

    websocket_event = getattr(request.state, "_websocket_event", None)
    if websocket_event:
        await manager.send_to_user(
            websocket_event["recipient_user_id"],
            websocket_event["payload"],
        )

    return response


@app.websocket("/ws/messages")
async def websocket_messages(websocket: WebSocket):
    token = websocket.query_params.get("token")
    current_user = None
    if not token:
        await websocket.close(code=1008)
        return

    db = SessionLocal()
    try:
        try:
            current_user = get_user_from_access_token(token, db)
        except Exception:
            await websocket.close(code=1008)
            return

        await manager.connect(current_user.id, websocket)

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if current_user is not None:
            try:
                manager.disconnect(current_user.id, websocket)
            except Exception:
                pass
        db.close()

@app.get("/")
def read_root():
    return {"mesaj": "Komşum API Çalışıyor! 🚀"}

