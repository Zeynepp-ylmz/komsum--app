from fastapi import APIRouter, Depends, HTTPException, Query, Request
from app.rate_limiter import limiter
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import List
import os
from app.database import get_db
from app.models import Kullanici, Ilan, Yorum
from app.schemas import KullaniciRead
from app.auth import verify_admin_access

router = APIRouter(
    prefix="/admin",
    tags=["Admin"]
)

def cleanup_ilan_files(ilan_obj):
    for medya in ilan_obj.medyalar:
        if os.path.exists(medya.dosya_yolu):
            try:
                os.remove(medya.dosya_yolu)
            except Exception as e:
                print(f"Dosya silinemedi: {e}")

@router.get("/users", response_model=List[KullaniciRead])
def admin_tum_kullanicilari_listele(
    mahalle_id: int | None = Query(default=None),
    q: str | None = Query(default=None),
    admin_user: Kullanici = Depends(verify_admin_access),
    db: Session = Depends(get_db)
):
    query = db.query(Kullanici)

    if mahalle_id is not None:
        query = query.filter(Kullanici.mahalle_id == mahalle_id)

    if q:
        normalized_query = q.strip()
        query = query.filter(
            or_(
                Kullanici.ad.ilike(f"%{normalized_query}%"),
                Kullanici.soyad.ilike(f"%{normalized_query}%"),
                Kullanici.eposta.ilike(f"%{normalized_query}%"),
            )
        )

    return query.all()

@router.get("/stats")
def admin_istatistikleri_getir(
    mahalle_id: int | None = Query(default=None),
    admin_user: Kullanici = Depends(verify_admin_access),
    db: Session = Depends(get_db)
):
    users_query = db.query(Kullanici)
    ilans_query = db.query(Ilan)
    comments_query = db.query(Yorum).join(Ilan, Yorum.ilan_id == Ilan.id)

    if mahalle_id is not None:
        users_query = users_query.filter(Kullanici.mahalle_id == mahalle_id)
        ilans_query = ilans_query.filter(Ilan.mahalle_id == mahalle_id)
        comments_query = comments_query.filter(Ilan.mahalle_id == mahalle_id)

    total_users = users_query.count()
    total_ilans = ilans_query.count()
    total_comments = comments_query.count()
    
    return {
        "toplam_kullanici": total_users,
        "toplam_ilan": total_ilans,
        "toplam_yorum": total_comments
    }

@router.delete("/users/{user_id}")
@limiter.limit("30/minute")
def admin_kullanici_sil(request: Request, user_id: int, admin_user: Kullanici = Depends(verify_admin_access), db: Session = Depends(get_db)):
    if user_id == admin_user.id:
         raise HTTPException(status_code=400, detail="Kendinizi silemezsiniz.")

    user_to_delete = db.query(Kullanici).filter(Kullanici.id == user_id).first()
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="Silinecek kullanıcı bulunamadı")
    
    for ilan in user_to_delete.ilanlar:
        cleanup_ilan_files(ilan)
    
    db.delete(user_to_delete)
    db.commit()
    return {"mesaj": f"Kullanıcı (ID: {user_id}) yönetici tarafından silindi."}

@router.delete("/ilanlar/{ilan_id}")
@limiter.limit("30/minute")
def admin_ilan_sil(request: Request, ilan_id: int, admin_user: Kullanici = Depends(verify_admin_access), db: Session = Depends(get_db)):
    ilan = db.query(Ilan).filter(Ilan.id == ilan_id).first()
    if not ilan:
        raise HTTPException(status_code=404, detail="İlan bulunamadı")
    
    cleanup_ilan_files(ilan)
    
    db.delete(ilan)
    db.commit()
    return {"mesaj": f"İlan (ID: {ilan_id}) yönetici tarafından silindi."}
