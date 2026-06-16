from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from app.rate_limiter import limiter
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
import datetime
import os
import socket
import uuid
from app.database import get_db
from app.models import Kullanici, Ilan, Mahalle
from app.schemas import KullaniciRead, KullaniciUpdate, PasswordChange, AramaGecmisiRead, IlanRead, KullaniciIstatistik
from app.auth import get_current_user, verify_password, get_password_hash, create_access_token, send_verification_email
from app.utils import tr_normalize, validate_password_strength

router = APIRouter(
    prefix="/kullanicilar",
    tags=["Kullanıcılar"]
)

PROFIL_RESIM_DIR = "static/profil_resimleri"
if not os.path.exists(PROFIL_RESIM_DIR):
    os.makedirs(PROFIL_RESIM_DIR)

ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "gif"}
ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/gif"}
MAX_PROFILE_IMAGE_SIZE_BYTES = 3 * 1024 * 1024
UPLOAD_CHUNK_SIZE = 1024 * 1024

def validate_image_file(file: UploadFile) -> str:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Dosya adı boş olamaz.")
    ext = file.filename.split(".")[-1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Geçersiz dosya uzantısı.")
    if file.content_type not in ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Geçersiz dosya formatı.")
    return ext

def save_profile_image_with_limit(file: UploadFile, dosya_yolu: str, max_size: int) -> None:
    written = 0
    try:
        file.file.seek(0)
        with open(dosya_yolu, "wb") as buffer:
            while True:
                chunk = file.file.read(UPLOAD_CHUNK_SIZE)
                if not chunk:
                    break
                written += len(chunk)
                if written > max_size:
                    raise HTTPException(status_code=413, detail="Profil resmi en fazla 3 MB olabilir.")
                buffer.write(chunk)
    except HTTPException:
        if os.path.exists(dosya_yolu):
            os.remove(dosya_yolu)
        raise
    except Exception:
        if os.path.exists(dosya_yolu):
            os.remove(dosya_yolu)
        raise HTTPException(status_code=500, detail="Dosya kaydedilirken hata oluştu.")

def delete_profile_image_file(dosya_yolu: str | None) -> None:
    if not dosya_yolu:
        return

    try:
        if os.path.exists(dosya_yolu):
            os.remove(dosya_yolu)
    except Exception:
        # Resim silinemese bile kullanıcının profil güncelleme akışını bozma.
        pass

@router.get("/ara", response_model=List[KullaniciRead])
def kullanici_ara(q: str, db: Session = Depends(get_db)):
    if not q:
        return []
    q_normalized = tr_normalize(q)
    sonuclar = db.query(Kullanici).filter(
        Kullanici.arama_metni.like(f"{q_normalized}%")
    ).all()
    return sonuclar

@router.get("/me", response_model=KullaniciRead)
def kendi_profilimi_getir(current_user: Kullanici = Depends(get_current_user)):
    return current_user

@router.put("/me", response_model=KullaniciRead)
def kullanici_guncelle(
    kullanici_update: KullaniciUpdate,
    current_user: Kullanici = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_user = current_user
    update_data = kullanici_update.dict(exclude_unset=True)
    email_degisti = False

    if "eposta" in update_data:
        yeni_eposta = update_data["eposta"]
        if yeni_eposta == db_user.eposta:
            update_data.pop("eposta")
        else:
            eposta_sahibi = db.query(Kullanici).filter(
                Kullanici.eposta == yeni_eposta,
                Kullanici.id != db_user.id
            ).first()
            if eposta_sahibi:
                raise HTTPException(status_code=400, detail="Bu e-posta adresi zaten kullanımda.")
            pending_eposta_sahibi = db.query(Kullanici).filter(
                Kullanici.pending_email == yeni_eposta,
                Kullanici.id != db_user.id
            ).first()
            if pending_eposta_sahibi:
                raise HTTPException(status_code=400, detail="Bu e-posta adresi zaten kullanımda.")
            update_data.pop("eposta")
            db_user.pending_email = yeni_eposta
            email_degisti = True
    
    if "mahalle_id" in update_data:
        yeni_mahalle_id = update_data["mahalle_id"]
        yeni_mahalle = db.query(Mahalle).filter(Mahalle.id == yeni_mahalle_id).first()
        if not yeni_mahalle:
            raise HTTPException(status_code=400, detail="Geçersiz mahalle seçimi")

        if db_user.mahalle_id != yeni_mahalle_id:
            simdi = datetime.datetime.utcnow()
            son_degisiklik = db_user.son_mahalle_degisikligi or datetime.datetime.min
            gecen_gun = (simdi - son_degisiklik).days
            
            if gecen_gun < 30:
                kalan_gun = 30 - gecen_gun
                raise HTTPException(
                    status_code=400, 
                    detail=f"Mahalle değişikliğini 30 günde bir yapabilirsiniz. Kalan süre: {kalan_gun} gün."
                )
            db_user.son_mahalle_degisikligi = simdi

    for key, value in update_data.items():
        setattr(db_user, key, value)

    if "ad" in update_data or "soyad" in update_data:
        db_user.arama_metni = tr_normalize(f"{db_user.ad} {db_user.soyad}")

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Bu e-posta adresi zaten kullanımda.")

    db.refresh(db_user)

    if email_degisti:
        verify_token = create_access_token(
            data={"sub": db_user.pending_email, "type": "verify"},
            expires_delta=datetime.timedelta(hours=24)
        )
        try:
            local_ip = socket.gethostbyname(socket.gethostname())
        except Exception:
            local_ip = "127.0.0.1"
        app_url = os.getenv("APP_URL", f"http://{local_ip}:8000")
        verify_link = f"{app_url}/auth/verify-email?token={verify_token}"
        try:
            send_verification_email(db_user.pending_email, verify_link)
            print(f"✅ Doğrulama maili gönderildi: {db_user.pending_email}")
        except Exception as e:
            print(f"❌ Mail gönderme hatası: {e}")

    return db_user

@router.put("/me/sifre")
@limiter.limit("5/hour")
def kullanici_sifre_guncelle(
    request: Request,
    sifre_data: PasswordChange, 
    current_user: Kullanici = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    db_user = current_user
    if not verify_password(sifre_data.eski_sifre, db_user.password_hash):
        raise HTTPException(status_code=400, detail="Eski şifreniz hatalı.")
    if sifre_data.eski_sifre == sifre_data.yeni_sifre:
        raise HTTPException(status_code=400, detail="Yeni şifreniz eski şifrenizle aynı olamaz.")

    password_error = validate_password_strength(sifre_data.yeni_sifre)
    if password_error:
        raise HTTPException(status_code=400, detail=password_error)

    db_user.password_hash = get_password_hash(sifre_data.yeni_sifre)
    db.commit()
    return {"mesaj": "Şifreniz başarıyla güncellendi."}

@router.get("/me/arama-gecmisi", response_model=List[AramaGecmisiRead])
def kullanici_arama_gecmisi(current_user: Kullanici = Depends(get_current_user)):
    return current_user.arama_gecmisi

@router.get("/me/favoriler", response_model=List[IlanRead])
def kullanici_favorileri_getir(current_user: Kullanici = Depends(get_current_user)):
    return current_user.favori_ilanlar

@router.get("/me/ilanlar", response_model=List[IlanRead])
def benim_ilanlarim(current_user: Kullanici = Depends(get_current_user)):
    return current_user.ilanlar

@router.get("/me/stats", response_model=KullaniciIstatistik)
def kendi_istatistiklerim(current_user: Kullanici = Depends(get_current_user), db: Session = Depends(get_db)):
    kullanici_id = current_user.id
    ilan_sayisi = db.query(Ilan).filter(Ilan.kullanici_id == kullanici_id).count()
    yardim_sayisi = db.query(Ilan).filter(Ilan.kullanici_id == kullanici_id, Ilan.fiyat == 0).count()
    return {"ilan_sayisi": ilan_sayisi, "yardim_sayisi": yardim_sayisi}

@router.post("/me/profil-resmi-yukle", response_model=KullaniciRead)
@limiter.limit("30/hour")
async def profil_resmi_yukle(request: Request, file: UploadFile = File(...), current_user: Kullanici = Depends(get_current_user), db: Session = Depends(get_db)):
    kullanici = current_user
    ext = validate_image_file(file)
    onceki_dosya_yolu = kullanici.profil_resmi

    yeni_dosya_adi = f"user_{kullanici.id}_{uuid.uuid4().hex[:8]}.{ext}"
    dosya_yolu = os.path.join(PROFIL_RESIM_DIR, yeni_dosya_adi)

    save_profile_image_with_limit(file=file, dosya_yolu=dosya_yolu, max_size=MAX_PROFILE_IMAGE_SIZE_BYTES)

    kullanici.profil_resmi = dosya_yolu
    db.commit()
    db.refresh(kullanici)
    delete_profile_image_file(onceki_dosya_yolu)
    return kullanici

@router.delete("/me/profil-resmi", response_model=KullaniciRead)
@limiter.limit("30/hour")
def profil_resmi_kaldir(request: Request, current_user: Kullanici = Depends(get_current_user), db: Session = Depends(get_db)):
    kullanici = current_user
    onceki_dosya_yolu = kullanici.profil_resmi

    kullanici.profil_resmi = None
    db.commit()
    db.refresh(kullanici)
    delete_profile_image_file(onceki_dosya_yolu)
    return kullanici

@router.get("/{kullanici_id}", response_model=KullaniciRead)
def kullanici_profilini_getir(kullanici_id: int, db: Session = Depends(get_db)):
    kullanici = db.query(Kullanici).filter(Kullanici.id == kullanici_id).first()
    if not kullanici:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    return kullanici

@router.get("/{kullanici_id}/ilanlar", response_model=List[IlanRead])
def kullanici_ilanlari(kullanici_id: int, db: Session = Depends(get_db)):
    kullanici = db.query(Kullanici).filter(Kullanici.id == kullanici_id).first()
    if not kullanici:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    return kullanici.ilanlar

@router.get("/{kullanici_id}/stats", response_model=KullaniciIstatistik)
def kullanici_istatistikleri(kullanici_id: int, db: Session = Depends(get_db)):
    kullanici = db.query(Kullanici).filter(Kullanici.id == kullanici_id).first()
    if not kullanici:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    ilan_sayisi = db.query(Ilan).filter(Ilan.kullanici_id == kullanici_id).count()
    yardim_sayisi = db.query(Ilan).filter(Ilan.kullanici_id == kullanici_id, Ilan.fiyat == 0).count()
    
    return {"ilan_sayisi": ilan_sayisi, "yardim_sayisi": yardim_sayisi}
