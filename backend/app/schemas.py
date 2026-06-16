from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import List, Optional
import datetime
import datetime


from app.utils import validate_password_strength

def sifre_dogrula(sifre: str) -> str:
    """Şifre doğrulama kuralları (utils'den alır)"""
    error = validate_password_strength(sifre)
    if error:
        raise ValueError(error)
    return sifre

class MedyaBase(BaseModel):
    id: Optional[int] = None
    dosya_yolu: str
    tip: str

    class Config:
        from_attributes = True

class IlanBase(BaseModel):
    baslik: str
    aciklama: str
    fiyat: float
    kategori_id: int

class KategoriRead(BaseModel):
    id: int
    ad: str

    class Config:
        from_attributes = True

class IlRead(BaseModel):
    id: int
    ad: str

    class Config:
        from_attributes = True

class IlceRead(BaseModel):
    id: int
    ad: str
    il_id: int

    class Config:
        from_attributes = True

class EtiketRead(BaseModel):
    id: int
    ad: str

    class Config:
        from_attributes = True

class MahalleRead(BaseModel):
    id: int
    ad: str
    sehir: str
    ilce_id: Optional[int] = None

    class Config:
        from_attributes = True

class KullaniciRead(BaseModel):
    id: int
    ad: str
    soyad: str
    eposta: EmailStr
    is_admin: bool
    mahalle_id: int
    mahalle: Optional[MahalleRead] = None
    profil_resmi: Optional[str] = None
    guven_duzeyi: float = 10.0
    bildirim_acik: bool
    is_verified: bool

    class Config:
        from_attributes = True

class IlanRead(IlanBase):
    id: int
    tarih: datetime.datetime
    medyalar: List[MedyaBase] = []
    kategori: Optional[KategoriRead] = None
    sahibi: Optional[KullaniciRead] = None
    etiketler: List[EtiketRead] = []

    class Config:
        from_attributes = True

class KullaniciCreate(BaseModel):
    ad: str
    soyad: str
    eposta: EmailStr
    password: str
    mahalle_id: int

    @field_validator('eposta')
    @classmethod
    def eposta_gmail_kontrolu(cls, v):
        if not v.endswith('@gmail.com'):
            raise ValueError('Sadece Gmail hesapları kabul edilmektedir (@gmail.com)')
        return v

    @field_validator('password')
    @classmethod
    def password_dogrula(cls, v):
        return sifre_dogrula(v)

class YorumCreate(BaseModel):
    icerik: str
    puan: int = Field(..., ge=1, le=5, description="Puan 1 ile 5 arasında olmalıdır")

class YorumRead(BaseModel):
    id: int
    icerik: str
    puan: int
    tarih: datetime.datetime
    yazan_kullanici_id: int
    yazan_ad: Optional[str] = None
    yazan_soyad: Optional[str] = None
    yazan_profil_resmi: Optional[str] = None
    yazan_guven_duzeyi: Optional[float] = None
    
    class Config:
        from_attributes = True

class MesajCreate(BaseModel):
    metin: str
    alici_id: int
    ilan_id: Optional[int] = None

class MesajRead(BaseModel):
    id: int
    metin: str
    tarih: datetime.datetime
    gonderen_id: int
    alici_id: int
    ilan_id: Optional[int]
    okundu: bool

    class Config:
        from_attributes = True

class GelenKutusuItem(BaseModel):
    karsi_taraf_id: int
    karsi_taraf_ad: str
    karsi_taraf_soyad: str
    karsi_taraf_profil_resmi: Optional[str]
    ilan_id: Optional[int]
    ilan_baslik: Optional[str]
    son_mesaj: str
    son_mesaj_tarihi: datetime.datetime
    okunmamis_sayisi: int

class KullaniciUpdate(BaseModel):
    ad: Optional[str] = None
    soyad: Optional[str] = None
    eposta: Optional[EmailStr] = None
    mahalle_id: Optional[int] = None
    bildirim_acik: Optional[bool] = None

    @field_validator('eposta')
    @classmethod
    def eposta_gmail_kontrolu(cls, v):
        if v is None:
            return v
        if not v.endswith('@gmail.com'):
            raise ValueError('Sadece Gmail hesapları kabul edilmektedir (@gmail.com)')
        return v

class PushTokenCreate(BaseModel):
    expo_push_token: str
    platform: Optional[str] = None

class PasswordChange(BaseModel):
    eski_sifre: str
    yeni_sifre: str

    @field_validator('yeni_sifre')
    @classmethod
    def yeni_sifre_dogrula(cls, v):
        return sifre_dogrula(v)

class ResetPasswordRequest(BaseModel):
    token: str
    yeni_sifre: str

class AramaGecmisiRead(BaseModel):
    id: int
    arama_terimi: str
    tarih: datetime.datetime

    class Config:
        from_attributes = True

class KullaniciIstatistik(BaseModel):
    ilan_sayisi: int
    yardim_sayisi: int = 0
