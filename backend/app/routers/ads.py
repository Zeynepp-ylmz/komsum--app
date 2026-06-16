from fastapi import APIRouter, Depends, HTTPException, Request, Form, UploadFile, File
from app.rate_limiter import limiter
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
import os
import uuid
import datetime
from app.database import get_db
from app.models import Il, Ilce, Ilan, Kategori, Mahalle, Etiket, Medya, Kullanici, AramaGecmisi
from app.schemas import IlRead, IlanRead, IlceRead, KategoriRead, MahalleRead
from app.auth import get_current_user, verify_admin_access

router = APIRouter(
    tags=["İlanlar ve Konum"]
)

UPLOAD_DIR = "static/ilan_resimleri"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "heic", "heif"}
ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/gif","image/heic",
    "image/heif",}
MAX_AD_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
MAX_AD_TOTAL_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_AD_IMAGE_COUNT = 8
UPLOAD_CHUNK_SIZE = 1024 * 1024

def cleanup_ilan_files(ilan_obj):
    for medya in ilan_obj.medyalar:
        if os.path.exists(medya.dosya_yolu):
            try:
                os.remove(medya.dosya_yolu)
            except Exception as e:
                print(f"Dosya silinemedi: {e}")

def cleanup_uploaded_paths(paths: List[str]):
    for path in paths:
        if os.path.exists(path):
            try:
                os.remove(path)
            except Exception:
                pass

def normalize_upload_files(files: Optional[List[UploadFile]]) -> List[UploadFile]:
    if not files:
        return []
    return [file for file in files if file and file.filename]

def validate_image_file(file: UploadFile) -> str:
    ext = file.filename.split(".")[-1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Geçersiz dosya uzantısı.")
    if file.content_type not in ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Geçersiz dosya formatı.")
    return ext

def save_upload_with_limits(
    file: UploadFile,
    dosya_yolu: str,
    max_file_size: int,
    current_total_size: int,
    max_total_size: int
) -> int:
    written = 0
    try:
        file.file.seek(0)
        with open(dosya_yolu, "wb") as buffer:
            while True:
                chunk = file.file.read(UPLOAD_CHUNK_SIZE)
                if not chunk:
                    break
                written += len(chunk)
                if written > max_file_size:
                    raise HTTPException(status_code=413, detail="Tek dosya boyutu en fazla 5 MB olabilir.")
                if current_total_size + written > max_total_size:
                    raise HTTPException(status_code=413, detail="Toplam dosya boyutu en fazla 20 MB olabilir.")
                buffer.write(chunk)
    except HTTPException:
        if os.path.exists(dosya_yolu):
            os.remove(dosya_yolu)
        raise
    except Exception:
        if os.path.exists(dosya_yolu):
            os.remove(dosya_yolu)
        raise HTTPException(status_code=500, detail="Dosya kaydedilirken hata oluştu.")
    return written

# --- KATEGORİ & MAHALLE ---
@router.get("/kategoriler/", tags=["Kategoriler"], response_model=List[KategoriRead])
def kategorileri_getir(db: Session = Depends(get_db)):
    return db.query(Kategori).all()

@router.get("/mahaleler/", tags=["Konum"], response_model=List[MahalleRead])
def mahaleleri_getir(db: Session = Depends(get_db)):
    return db.query(Mahalle).all()

@router.get("/locations/cities", tags=["Konum"], response_model=List[IlRead])
def sehirleri_getir(db: Session = Depends(get_db)):
    return db.query(Il).order_by(Il.ad.asc()).all()

@router.get("/locations/districts", tags=["Konum"], response_model=List[IlceRead])
def ilceleri_getir(city_id: int, db: Session = Depends(get_db)):
    return db.query(Ilce).filter(Ilce.il_id == city_id).order_by(Ilce.ad.asc()).all()

@router.get("/locations/neighborhoods", tags=["Konum"], response_model=List[MahalleRead])
def ilce_mahallelerini_getir(district_id: int, db: Session = Depends(get_db)):
    return db.query(Mahalle).filter(Mahalle.ilce_id == district_id).order_by(Mahalle.ad.asc()).all()

@router.post("/mahaleler/", tags=["Konum"])
def mahalle_olustur(ad: str, sehir: str, admin_user: Kullanici = Depends(verify_admin_access), db: Session = Depends(get_db)):
    yeni_mahalle = Mahalle(ad=ad, sehir=sehir)
    db.add(yeni_mahalle)
    db.commit()
    return yeni_mahalle

@router.delete("/mahaleler/{mahalle_id}", tags=["Konum"])
def mahalle_sil(mahalle_id: int, admin_user: Kullanici = Depends(verify_admin_access), db: Session = Depends(get_db)):
    mahalle = db.query(Mahalle).filter(Mahalle.id == mahalle_id).first()
    if not mahalle:
        raise HTTPException(status_code=404, detail="Mahalle bulunamadı")
    
    bagli_kullanici = db.query(Kullanici).filter(Kullanici.mahalle_id == mahalle_id).count()
    if bagli_kullanici > 0:
        raise HTTPException(status_code=400, detail=f"Bu mahallede {bagli_kullanici} kayıtlı kullanıcı var. Silinemez.")
    
    bagli_ilan = db.query(Ilan).filter(Ilan.mahalle_id == mahalle_id).count()
    if bagli_ilan > 0:
        raise HTTPException(status_code=400, detail=f"Bu mahallede {bagli_ilan} aktif ilan var. Silinemez.")
    
    db.delete(mahalle)
    db.commit()
    return {"mesaj": f"'{mahalle.ad}' mahallesi başarıyla silindi."}

# --- İLANLAR ---
@router.post("/ilanlar/", response_model=IlanRead, tags=["İlanlar"])
@limiter.limit("20/hour")
def ilan_olustur(
    request: Request,
    baslik: str = Form(...),
    aciklama: str = Form(...),
    fiyat: float = Form(0),
    kategori_id: int = Form(...),
    etiketler: List[str] = Form([]),
    files: List[UploadFile] = File(None),
    current_user: Kullanici = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    if fiyat < 0:
        raise HTTPException(status_code=400, detail="Fiyat negatif olamaz.")

    incoming_files = normalize_upload_files(files)
    if len(incoming_files) > MAX_AD_IMAGE_COUNT:
        raise HTTPException(status_code=400, detail="Bir ilana en fazla 8 görsel yükleyebilirsiniz.")
    for file in incoming_files:
        validate_image_file(file)

    kategori = db.query(Kategori).filter(Kategori.id == kategori_id).first()
    if not kategori:
        raise HTTPException(status_code=400, detail="Geçersiz kategori seçimi")

    kullanici_mahallesi = db.query(Mahalle).filter(Mahalle.id == current_user.mahalle_id).first()
    if not kullanici_mahallesi:
        raise HTTPException(status_code=400, detail="Kullanıcıya ait mahalle bulunamadı")

    yeni_ilan = Ilan(
        baslik=baslik,
        aciklama=aciklama,
        fiyat=fiyat,
        kategori_id=kategori_id,
        kullanici_id=current_user.id,
        mahalle_id=current_user.mahalle_id
    )

    for ad in etiketler:
        alt_etiketler = ad.split(',')
        for alt_ad in alt_etiketler:
            clean_ad = alt_ad.lower().strip()
            if not clean_ad: continue
            etiket_obj = db.query(Etiket).filter(Etiket.ad == clean_ad).first()
            if not etiket_obj:
                etiket_obj = Etiket(ad=clean_ad)
                db.add(etiket_obj)
                db.flush()
            yeni_ilan.etiketler.append(etiket_obj)

    uploaded_paths: List[str] = []
    total_uploaded_bytes = 0
    try:
        db.add(yeni_ilan)
        db.flush()

        for file in incoming_files:
            ext = validate_image_file(file)
            yeni_dosya_adi = f"{uuid.uuid4()}.{ext}"
            dosya_yolu = os.path.join(UPLOAD_DIR, yeni_dosya_adi)
            written = save_upload_with_limits(
                file=file,
                dosya_yolu=dosya_yolu,
                max_file_size=MAX_AD_IMAGE_SIZE_BYTES,
                current_total_size=total_uploaded_bytes,
                max_total_size=MAX_AD_TOTAL_UPLOAD_BYTES
            )
            total_uploaded_bytes += written
            uploaded_paths.append(dosya_yolu)
            db.add(Medya(dosya_yolu=dosya_yolu, tip="image", ilan_id=yeni_ilan.id))

        db.commit()
        db.refresh(yeni_ilan)
    except HTTPException:
        db.rollback()
        cleanup_uploaded_paths(uploaded_paths)
        raise
    except Exception:
        db.rollback()
        cleanup_uploaded_paths(uploaded_paths)
        raise

    return yeni_ilan

@router.get("/ilanlar/", response_model=List[IlanRead], tags=["İlanlar"])
def ilanlari_listele(
        current_user: Kullanici = Depends(get_current_user),
        q: Optional[str] = None,
        kategori_id: Optional[int] = None,
        kategori_ad: Optional[str] = None,
        etiket_arama: Optional[str] = None,
        min_fiyat: Optional[float] = None,
        max_fiyat: Optional[float] = None,
        son_kac_gun: Optional[int] = None,
        limit: Optional[int] = None,
        siralama: Optional[str] = None,
        db: Session = Depends(get_db)
):
    kullanici = current_user
    query = db.query(Ilan).filter(Ilan.mahalle_id == kullanici.mahalle_id)

    if q:
        search_term = q.strip()
        if search_term:
            query = query.filter(
                or_(
                    Ilan.baslik.ilike(f"%{search_term}%"),
                    Ilan.aciklama.ilike(f"%{search_term}%")
                )
            )

    if kategori_id:
        query = query.filter(Ilan.kategori_id == kategori_id)

    if kategori_ad:
        aranan_kategoriler = db.query(Kategori).filter(Kategori.ad.ilike(f"%{kategori_ad}%")).all()
        kategori_id_listesi = [k.id for k in aranan_kategoriler]
        if kategori_id_listesi:
            query = query.filter(Ilan.kategori_id.in_(kategori_id_listesi))
        else:
            return []
        
    if min_fiyat is not None: query = query.filter(Ilan.fiyat >= min_fiyat)
    if max_fiyat is not None: query = query.filter(Ilan.fiyat <= max_fiyat)

    if son_kac_gun:
        limit_tarih = datetime.datetime.utcnow() - datetime.timedelta(days=son_kac_gun)
        query = query.filter(Ilan.tarih >= limit_tarih)

    if etiket_arama:
        query = query.join(Ilan.etiketler).filter(Etiket.ad.contains(etiket_arama.lower()))
        yeni_arama = AramaGecmisi(arama_terimi=etiket_arama, kullanici_id=kullanici.id)
        db.add(yeni_arama)
        db.commit()
    
    if siralama == "fiyat_artan": query = query.order_by(Ilan.fiyat.asc())
    elif siralama == "fiyat_azalan": query = query.order_by(Ilan.fiyat.desc())
    elif siralama == "yeni": query = query.order_by(Ilan.id.desc())
    elif siralama == "eski": query = query.order_by(Ilan.id.asc())

    if limit: query = query.limit(limit)

    return query.all()

@router.get("/ilanlar/{ilan_id}", response_model=IlanRead, tags=["İlanlar"])
def ilan_detayi_getir(
    ilan_id: int,
    current_user: Kullanici = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ilan = db.query(Ilan).filter(
        Ilan.id == ilan_id,
        Ilan.mahalle_id == current_user.mahalle_id
    ).first()
    if not ilan:
        raise HTTPException(status_code=404, detail="İlan bulunamadı")
    return ilan

@router.delete("/ilanlar/{ilan_id}", tags=["İlanlar"])
def ilan_sil(ilan_id: int, current_user: Kullanici = Depends(get_current_user), db: Session = Depends(get_db)):
    ilan = db.query(Ilan).filter(Ilan.id == ilan_id).first()
    if not ilan:
        raise HTTPException(status_code=404, detail="İlan bulunamadı")
    if ilan.kullanici_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bu ilanı silme yetkiniz yok.")
    
    cleanup_ilan_files(ilan)
    db.delete(ilan)
    db.commit()
    return {"mesaj": "İlan başarıyla silindi"}

@router.put("/ilanlar/{ilan_id}", response_model=IlanRead, tags=["İlanlar"])
def ilan_guncelle(
    ilan_id: int,
    baslik: Optional[str] = Form(None),
    aciklama: Optional[str] = Form(None),
    fiyat: Optional[float] = Form(None),
    kategori_id: Optional[int] = Form(None),
    etiketler: List[str] = Form(None),
    silinecek_medya_ids: List[int] = Form(None),
    files: List[UploadFile] = File(None),
    current_user: Kullanici = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    db_ilan = db.query(Ilan).filter(Ilan.id == ilan_id).first()
    if not db_ilan:
        raise HTTPException(status_code=404, detail="İlan bulunamadı")
    if db_ilan.kullanici_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bu ilanı güncelleme yetkiniz yok.")

    incoming_files = normalize_upload_files(files)
    for file in incoming_files:
        validate_image_file(file)

    silinecek_ids = silinecek_medya_ids or []
    silinecek_sayi = 0
    if silinecek_ids:
        silinecek_sayi = db.query(Medya).filter(
            Medya.id.in_(silinecek_ids),
            Medya.ilan_id == ilan_id
        ).count()
    mevcut_sayi = len(db_ilan.medyalar)
    hedef_sayi = mevcut_sayi - silinecek_sayi + len(incoming_files)
    if hedef_sayi > MAX_AD_IMAGE_COUNT:
        raise HTTPException(status_code=400, detail="Bir ilana en fazla 8 görsel yükleyebilirsiniz.")

    if baslik is not None: db_ilan.baslik = baslik
    if aciklama is not None: db_ilan.aciklama = aciklama
    if fiyat is not None: 
        if fiyat < 0: raise HTTPException(status_code=400, detail="Fiyat negatif olamaz.")
        db_ilan.fiyat = fiyat
    if kategori_id is not None:
        kategori = db.query(Kategori).filter(Kategori.id == kategori_id).first()
        if not kategori:
            raise HTTPException(status_code=400, detail="Geçersiz kategori seçimi")
        db_ilan.kategori_id = kategori_id

    if etiketler is not None:
        db_ilan.etiketler = []
        for ad in etiketler:
            split_tags = ad.split(',')
            for t in split_tags:
                clean_tag = t.lower().strip()
                if not clean_tag: continue
                etiket_obj = db.query(Etiket).filter(Etiket.ad == clean_tag).first()
                if not etiket_obj:
                    etiket_obj = Etiket(ad=clean_tag)
                    db.add(etiket_obj)
                    db.flush()
                db_ilan.etiketler.append(etiket_obj)

    if silinecek_medya_ids:
        medyalar_to_delete = db.query(Medya).filter(Medya.id.in_(silinecek_medya_ids), Medya.ilan_id == ilan_id).all()
        for medya in medyalar_to_delete:
            if os.path.exists(medya.dosya_yolu):
                try: os.remove(medya.dosya_yolu)
                except: pass
            db.delete(medya)
    
    uploaded_paths: List[str] = []
    total_uploaded_bytes = 0
    try:
        for file in incoming_files:
            ext = validate_image_file(file)
            yeni_dosya_adi = f"{uuid.uuid4()}.{ext}"
            dosya_yolu = os.path.join(UPLOAD_DIR, yeni_dosya_adi)
            written = save_upload_with_limits(
                file=file,
                dosya_yolu=dosya_yolu,
                max_file_size=MAX_AD_IMAGE_SIZE_BYTES,
                current_total_size=total_uploaded_bytes,
                max_total_size=MAX_AD_TOTAL_UPLOAD_BYTES
            )
            total_uploaded_bytes += written
            uploaded_paths.append(dosya_yolu)
            db.add(Medya(dosya_yolu=dosya_yolu, tip="image", ilan_id=ilan_id))
    except HTTPException:
        db.rollback()
        cleanup_uploaded_paths(uploaded_paths)
        raise
    except Exception:
        db.rollback()
        cleanup_uploaded_paths(uploaded_paths)
        raise

    db.commit()
    db.refresh(db_ilan)
    return db_ilan
