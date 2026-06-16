from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Table, Boolean
from sqlalchemy.orm import relationship
import datetime
from app.database import Base
from app.utils import tr_normalize

# --- ARA TABLOLAR ---

ilan_etiket = Table(
    'ilan_etiket', Base.metadata,
    Column('ilan_id', Integer, ForeignKey('ilanlar.id'), primary_key=True),
    Column('etiket_id', Integer, ForeignKey('etiketler.id'), primary_key=True)
)

favoriler = Table(
    'favoriler', Base.metadata,
    Column('kullanici_id', Integer, ForeignKey('kullanicilar.id'), primary_key=True),
    Column('ilan_id', Integer, ForeignKey('ilanlar.id'), primary_key=True)
)

# --- MODELLER ---

class Il(Base):
    __tablename__ = "iller"
    id = Column(Integer, primary_key=True, index=True)
    ad = Column(String, unique=True, index=True)

    ilceler = relationship("Ilce", back_populates="il", cascade="all, delete-orphan")

class Ilce(Base):
    __tablename__ = "ilceler"
    id = Column(Integer, primary_key=True, index=True)
    ad = Column(String, index=True)
    il_id = Column(Integer, ForeignKey("iller.id"), nullable=False, index=True)

    il = relationship("Il", back_populates="ilceler")
    mahalleler = relationship("Mahalle", back_populates="ilce")

class Mahalle(Base):
    __tablename__ = "mahalleler"
    id = Column(Integer, primary_key=True, index=True)
    ad = Column(String)
    sehir = Column(String)
    ilce_id = Column(Integer, ForeignKey("ilceler.id"), nullable=True, index=True)

    ilce = relationship("Ilce", back_populates="mahalleler")
    kullanicilar = relationship("Kullanici", back_populates="mahalle")
    ilanlar = relationship("Ilan", back_populates="mahalle")

class Kullanici(Base):
    __tablename__ = "kullanicilar"
    id = Column(Integer, primary_key=True, index=True)
    ad = Column(String)
    soyad = Column(String)
    eposta = Column(String, unique=True, index=True)
    pending_email = Column(String, unique=True, nullable=True)
    mahalle_id = Column(Integer, ForeignKey("mahalleler.id"))
    profil_resmi = Column(String, nullable=True)
    expo_push_token = Column(String, nullable=True)
    push_platform = Column(String, nullable=True)
    password_hash = Column(String) 
    is_verified = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    son_mahalle_degisikligi = Column(DateTime, default=datetime.datetime.utcnow)
    bildirim_acik = Column(Boolean, default=True)
    arama_metni = Column(String, index=True)

    mahalle = relationship("Mahalle", back_populates="kullanicilar")
    ilanlar = relationship("Ilan", back_populates="sahibi", cascade="all, delete-orphan")
    yazdigi_yorumlar = relationship("Yorum", back_populates="yazar", cascade="all, delete-orphan")
    arama_gecmisi = relationship("AramaGecmisi", back_populates="kullanici", cascade="all, delete-orphan")
    
    gonderilen_mesajlar = relationship("Mesaj", foreign_keys="[Mesaj.gonderen_id]", back_populates="gonderen")
    alinan_mesajlar = relationship("Mesaj", foreign_keys="[Mesaj.alici_id]", back_populates="alici")
    
    favori_ilanlar = relationship("Ilan", secondary=favoriler, back_populates="favorileyenler")

    @property
    def guven_duzeyi(self):
        toplam_puan = 0
        yorum_sayisi = 0
        
        for ilan in self.ilanlar:
            for yorum in ilan.yorumlar:
                toplam_puan += yorum.puan
                yorum_sayisi += 1
                
        if yorum_sayisi == 0:
            return 0.0
            
        ortalama = toplam_puan / yorum_sayisi
        return round(ortalama * 2, 1)

class Ilan(Base):
    __tablename__ = "ilanlar"
    id = Column(Integer, primary_key=True, index=True)
    baslik = Column(String)
    aciklama = Column(String)
    fiyat = Column(Float)
    tarih = Column(DateTime, default=datetime.datetime.utcnow)
    kategori_id = Column(Integer, ForeignKey("kategoriler.id"))
    kullanici_id = Column(Integer, ForeignKey("kullanicilar.id"))
    mahalle_id = Column(Integer, ForeignKey("mahalleler.id"))

    mahalle = relationship("Mahalle", back_populates="ilanlar")
    sahibi = relationship("Kullanici", back_populates="ilanlar")
    kategori = relationship("Kategori", back_populates="ilanlar")
    medyalar = relationship("Medya", back_populates="ilan", cascade="all, delete-orphan")
    yorumlar = relationship("Yorum", back_populates="ilan", cascade="all, delete-orphan")
    mesajlar = relationship("Mesaj", back_populates="ilan", cascade="all, delete-orphan")

    etiketler = relationship("Etiket", secondary=ilan_etiket, back_populates="ilanlar")
    favorileyenler = relationship("Kullanici", secondary=favoriler, back_populates="favori_ilanlar")

class Medya(Base):
    __tablename__ = "medyalar"
    id = Column(Integer, primary_key=True, index=True)
    dosya_yolu = Column(String)
    tip = Column(String)
    ilan_id = Column(Integer, ForeignKey("ilanlar.id"))

    ilan = relationship("Ilan", back_populates="medyalar")

class Kategori(Base):
    __tablename__ = "kategoriler"
    id = Column(Integer, primary_key=True, index=True)
    ad = Column(String)

    ilanlar = relationship("Ilan", back_populates="kategori")

class Yorum(Base):
    __tablename__ = "yorumlar"
    id = Column(Integer, primary_key=True, index=True)
    icerik = Column(String)
    puan = Column(Integer)
    tarih = Column(DateTime, default=datetime.datetime.utcnow)
    yazan_kullanici_id = Column(Integer, ForeignKey("kullanicilar.id"))
    ilan_id = Column(Integer, ForeignKey("ilanlar.id"))

    yazar = relationship("Kullanici", back_populates="yazdigi_yorumlar")
    ilan = relationship("Ilan", back_populates="yorumlar")

class Etiket(Base):
    __tablename__ = "etiketler"
    id = Column(Integer, primary_key=True, index=True)
    ad = Column(String)

    ilanlar = relationship("Ilan", secondary=ilan_etiket, back_populates="etiketler")

class Mesaj(Base):
    __tablename__ = "mesajlar"
    id = Column(Integer, primary_key=True, index=True)
    metin = Column(String)
    tarih = Column(DateTime, default=datetime.datetime.utcnow)
    okundu = Column(Boolean, default=False)
    
    gonderen_id = Column(Integer, ForeignKey("kullanicilar.id"))
    alici_id = Column(Integer, ForeignKey("kullanicilar.id"))
    ilan_id = Column(Integer, ForeignKey("ilanlar.id"), nullable=True)

    gonderen = relationship("Kullanici", foreign_keys=[gonderen_id], back_populates="gonderilen_mesajlar")
    alici = relationship("Kullanici", foreign_keys=[alici_id], back_populates="alinan_mesajlar")
    ilan = relationship("Ilan", back_populates="mesajlar")

class AramaGecmisi(Base):
    __tablename__ = "arama_gecmisi"
    id = Column(Integer, primary_key=True, index=True)
    arama_terimi = Column(String)
    tarih = Column(DateTime, default=datetime.datetime.utcnow)
    kullanici_id = Column(Integer, ForeignKey("kullanicilar.id"))

    kullanici = relationship("Kullanici", back_populates="arama_gecmisi")

class KaraListeToken(Base):
    __tablename__ = "kara_liste_tokenlar"
    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True)
    eklenen_tarih = Column(DateTime, default=datetime.datetime.utcnow)

class RefreshToken(Base):
    __tablename__ = "refresh_tokenlar"
    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True)
    kullanici_id = Column(Integer, ForeignKey("kullanicilar.id"))
    son_kullanma = Column(DateTime)
    iptal_edildi = Column(Boolean, default=False)
    olusturma_tarihi = Column(DateTime, default=datetime.datetime.utcnow)

    kullanici = relationship("Kullanici")

