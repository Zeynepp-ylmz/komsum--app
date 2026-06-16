import sys
import os

# App klasörünü görebilmesi için parent dizini ekle
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import Kullanici
from app.auth import get_password_hash
from app.utils import tr_normalize

def make_admin():
    print("--- KOMŞUM ADMİN OLUŞTURUCU ---")
    db = SessionLocal()
    email = input("Admin yapılacak e-posta adresi: ").strip()
    
    if not email:
        print("E-posta boş olamaz.")
        return

    user = db.query(Kullanici).filter(Kullanici.eposta == email).first()
    
    if user:
        print(f"✅ Kullanıcı bulundu: {user.ad} {user.soyad} (ID: {user.id})")
        if user.is_admin:
            print("ℹ️ Bu kullanıcı ZATEN admin yetkisine sahip.")
        else:
            confirm = input(f"{user.ad} {user.soyad} kişisine ADMIN yetkisi verilsin mi? (e/h): ")
            if confirm.lower() == 'e':
                user.is_admin = True
                db.commit()
                print("🚀 İşlem Tamam! Kullanıcı artık ADMIN.")
            else:
                print("İptal edildi.")
    else:
        print(f"❌ '{email}' ile kayıtlı kullanıcı bulunamadı.")
        create_new = input("Bu mail adresiyle yeni bir ADMIN oluşturulsun mu? (e/h): ")
        
        if create_new.lower() == 'e':
            ad = input("Ad: ")
            soyad = input("Soyad: ")
            password = input("Şifre: ")
            mahalle_id = input("Mahalle ID (Varsayılan 1): ") or "1"
            
            try:
                yeni_admin = Kullanici(
                    ad=ad,
                    soyad=soyad,
                    eposta=email,
                    password_hash=get_password_hash(password),
                    mahalle_id=int(mahalle_id),
                    is_verified=True,
                    is_admin=True,
                    arama_metni=tr_normalize(f"{ad} {soyad}")
                )
                db.add(yeni_admin)
                db.commit()
                print(f"✨ Yeni ADMIN hesabı oluşturuldu: {ad} {soyad} ({email})")
            except Exception as e:
                print(f"Hata oluştu: {e}")
        else:
            print("İşlem sonlandırıldı.")

if __name__ == "__main__":
    make_admin()
