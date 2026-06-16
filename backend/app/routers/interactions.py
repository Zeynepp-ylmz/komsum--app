from fastapi import APIRouter, Depends, HTTPException, Request
from app.rate_limiter import limiter
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Ilan, Yorum, Kullanici
from app.schemas import YorumCreate, YorumRead
from app.auth import get_current_user

router = APIRouter(
    tags=["Etkileşim"]
)

@router.post("/ilanlar/{ilan_id}/favorile")
@limiter.limit("60/minute")
def ilani_favorilere_ekle(request: Request, ilan_id: int, current_user: Kullanici = Depends(get_current_user), db: Session = Depends(get_db)):
    kullanici = current_user
    ilan = db.query(Ilan).filter(Ilan.id == ilan_id).first()

    if not ilan:
        raise HTTPException(status_code=404, detail="İlan bulunamadı")

    if ilan in kullanici.favori_ilanlar:
        kullanici.favori_ilanlar.remove(ilan)
        db.commit()
        return {"mesaj": "İlan favorilerden çıkarıldı", "durum": "cikarildi"}
    else:
        kullanici.favori_ilanlar.append(ilan)
        db.commit()
        return {"mesaj": "İlan favorilere eklendi", "durum": "eklendi"}

@router.get("/ilanlar/{ilan_id}/yorumlar", response_model=List[YorumRead])
def ilandaki_yorumlari_getir(ilan_id: int, db: Session = Depends(get_db)):
    ilan = db.query(Ilan).filter(Ilan.id == ilan_id).first()
    if not ilan:
        raise HTTPException(status_code=404, detail="İlan bulunamadı")
    
    yorumlar_data = []
    for y in ilan.yorumlar:
        yazar = y.yazar
        yorumlar_data.append({
            "id": y.id,
            "icerik": y.icerik,
            "puan": y.puan,
            "tarih": y.tarih,
            "yazan_kullanici_id": y.yazan_kullanici_id,
            "yazan_ad": yazar.ad,
            "yazan_soyad": yazar.soyad,
            "yazan_profil_resmi": yazar.profil_resmi,
            "yazan_guven_duzeyi": yazar.guven_duzeyi
        })
        
    return yorumlar_data

@router.post("/ilanlar/{ilan_id}/yorumlar")
@limiter.limit("60/minute")
def yorum_yap(request: Request, ilan_id: int, yorum: YorumCreate, current_user: Kullanici = Depends(get_current_user), db: Session = Depends(get_db)):
    ilan = db.query(Ilan).filter(Ilan.id == ilan_id).first()
    if not ilan:
        raise HTTPException(status_code=404, detail="İlan bulunamadı")
    
    yeni_yorum = Yorum(
        **yorum.dict(),
        yazan_kullanici_id=current_user.id,
        ilan_id=ilan_id
    )
    db.add(yeni_yorum)
    db.commit()
    db.refresh(yeni_yorum)

    if ilan.kullanici_id != current_user.id:
        request.state._websocket_event = {
            "recipient_user_id": ilan.kullanici_id,
            "payload": {
                "type": "notification:new",
                "kind": "comment",
                "comment_id": yeni_yorum.id,
                "ilan_id": ilan.id,
                "ilan_baslik": ilan.baslik,
                "yazan_kullanici_id": current_user.id,
            },
        }

    return {"mesaj": "Yorum eklendi", "yorum_id": yeni_yorum.id}

@router.delete("/yorumlar/{yorum_id}")
def yorum_sil(yorum_id: int, current_user: Kullanici = Depends(get_current_user), db: Session = Depends(get_db)):
    yorum = db.query(Yorum).filter(Yorum.id == yorum_id).first()
    if not yorum:
        raise HTTPException(status_code=404, detail="Yorum bulunamadı")

    if yorum.yazan_kullanici_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bu yorumu silme yetkiniz yok.")

    db.delete(yorum)
    db.commit()
    return {"mesaj": "Yorum başarıyla silindi"}
