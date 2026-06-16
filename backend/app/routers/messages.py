import asyncio

from fastapi import APIRouter, Depends, HTTPException, Request
from app.rate_limiter import limiter
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import Mesaj, Kullanici, Ilan
from app.schemas import MesajCreate, MesajRead, GelenKutusuItem
from app.auth import get_current_user
from app.services.push_service import send_push_notification

router = APIRouter(
    tags=["Mesajlaşma"]
)

@router.post("/mesajlar/")
@limiter.limit("60/minute")
def mesaj_gonder(request: Request, mesaj: MesajCreate, current_user: Kullanici = Depends(get_current_user), db: Session = Depends(get_db)):
    alici = db.query(Kullanici).filter(Kullanici.id == mesaj.alici_id).first()
    if not alici:
        raise HTTPException(status_code=404, detail="Alıcı kullanıcı bulunamadı")
    
    if current_user.id == mesaj.alici_id:
        raise HTTPException(status_code=400, detail="Kendinize mesaj atamazsınız.")

    yeni_mesaj = Mesaj(
        metin=mesaj.metin,
        gonderen_id=current_user.id,
        alici_id=mesaj.alici_id,
        ilan_id=mesaj.ilan_id
    )
    db.add(yeni_mesaj)
    db.commit()
    db.refresh(yeni_mesaj)

    if alici.expo_push_token:
        asyncio.run(
            send_push_notification(
                expo_push_token=alici.expo_push_token,
                title="Yeni mesajın var",
                body=f"{current_user.ad} sana mesaj gönderdi",
                data={
                    "type": "message",
                    "message_id": yeni_mesaj.id,
                    "sender_id": current_user.id,
                },
            )
        )

    message_payload = {
        "id": yeni_mesaj.id,
        "metin": yeni_mesaj.metin,
        "tarih": yeni_mesaj.tarih.isoformat() if yeni_mesaj.tarih else None,
        "gonderen_id": yeni_mesaj.gonderen_id,
        "alici_id": yeni_mesaj.alici_id,
        "ilan_id": yeni_mesaj.ilan_id,
        "okundu": yeni_mesaj.okundu,
    }
    request.state._websocket_event = {
        "recipient_user_id": mesaj.alici_id,
        "payload": {
            "type": "message:new",
            "message": message_payload,
        },
    }
    return {"mesaj": "Mesaj gönderildi"}

@router.get("/mesajlarim/sohbet/{karsi_taraf_id}", response_model=List[MesajRead])
def sohbet_gecmisini_getir(karsi_taraf_id: int, current_user: Kullanici = Depends(get_current_user), db: Session = Depends(get_db)):
    benim_id = current_user.id
    mesajlar = db.query(Mesaj).filter(
        ((Mesaj.gonderen_id == benim_id) & (Mesaj.alici_id == karsi_taraf_id)) | 
        ((Mesaj.gonderen_id == karsi_taraf_id) & (Mesaj.alici_id == benim_id))
    ).order_by(Mesaj.tarih.asc()).all()
    
    return mesajlar

@router.get("/mesajlarim/kutu", response_model=List[GelenKutusuItem])
def gelen_kutusunu_getir(current_user: Kullanici = Depends(get_current_user), db: Session = Depends(get_db)):
    benim_id = current_user.id
    tum_mesajlar = db.query(Mesaj).filter(
        (Mesaj.gonderen_id == benim_id) | (Mesaj.alici_id == benim_id)
    ).order_by(Mesaj.tarih.desc()).all()

    sohbetler = {} 

    for m in tum_mesajlar:
        if m.gonderen_id == benim_id:
            karsi_id = m.alici_id
        else:
            karsi_id = m.gonderen_id
        
        key = karsi_id

        if key not in sohbetler:
            karsi_user = db.query(Kullanici).filter(Kullanici.id == karsi_id).first()
            if not karsi_user: continue # Kullanici silinmis olabilir

            ilan_baslik = None
            if m.ilan_id:
                ilan_obj = db.query(Ilan).filter(Ilan.id == m.ilan_id).first()
                if ilan_obj:
                    ilan_baslik = ilan_obj.baslik
            
            sohbetler[key] = {
                "karsi_taraf_id": karsi_user.id,
                "karsi_taraf_ad": karsi_user.ad,
                "karsi_taraf_soyad": karsi_user.soyad,
                "karsi_taraf_profil_resmi": karsi_user.profil_resmi,
                "ilan_id": m.ilan_id,
                "ilan_baslik": ilan_baslik,
                "son_mesaj": m.metin,
                "son_mesaj_tarihi": m.tarih,
                "okunmamis_sayisi": 0
            }
        
        if m.alici_id == benim_id and not m.okundu:
            sohbetler[key]["okunmamis_sayisi"] += 1

    return list(sohbetler.values())

@router.post("/mesajlar/okundu-yap")
def mesajlari_okundu_isaretle(request: Request, karsi_taraf_id: int, ilan_id: Optional[int] = None, current_user: Kullanici = Depends(get_current_user), db: Session = Depends(get_db)):
    benim_id = current_user.id
    query = db.query(Mesaj).filter(
        Mesaj.alici_id == benim_id,
        Mesaj.gonderen_id == karsi_taraf_id,
        Mesaj.okundu == False
    )
    
    if ilan_id:
        query = query.filter(Mesaj.ilan_id == ilan_id)
        
    mesajlar = query.all()
    okunan_mesaj_idleri = [m.id for m in mesajlar]

    for m in mesajlar:
        m.okundu = True
    
    db.commit()

    if okunan_mesaj_idleri:
        request.state._websocket_event = {
            "recipient_user_id": karsi_taraf_id,
            "payload": {
                "type": "conversation:read",
                "reader_id": benim_id,
                "other_user_id": karsi_taraf_id,
                "ilan_id": ilan_id,
                "read_message_ids": okunan_mesaj_idleri,
            },
        }

    return {"mesaj": f"{len(mesajlar)} adet mesaj okundu olarak işaretlendi."}
