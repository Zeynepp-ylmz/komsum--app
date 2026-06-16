from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Kullanici
from app.schemas import PushTokenCreate

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"]
)


@router.post("/push-token")
def save_push_token(
    payload: PushTokenCreate,
    current_user: Kullanici = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.expo_push_token = payload.expo_push_token
    current_user.push_platform = payload.platform
    db.commit()
    db.refresh(current_user)
    return {"mesaj": "Push token kaydedildi."}
