import os
import datetime
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

from app.database import get_db
from app.models import Kullanici, KaraListeToken

load_dotenv()

# --- AYARLAR ---
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY .env dosyasında tanımlanmalıdır!")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30  # 30 dakika
REFRESH_TOKEN_EXPIRE_DAYS = 7  # 7 gün

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# --- YARDIMCI FONSİYONLAR ---

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    if "type" not in to_encode:
        to_encode["type"] = "access"
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt, expire


def get_user_from_access_token(token: str, db: Session):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Kimlik doğrulanamadı",
        headers={"WWW-Authenticate": "Bearer"},
    )

    kara_liste = db.query(KaraListeToken).filter(KaraListeToken.token == token).first()
    if kara_liste:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bu oturum sonlandırılmış. Lütfen tekrar giriş yapın.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        if email is None or token_type != "access":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(Kullanici).filter(Kullanici.eposta == email).first()
    if user is None:
        raise credentials_exception

    return user

def send_verification_email(to_email: str, verify_link: str):
    """
    SMTP kullanarak gmail üzerinden gerçek e-posta gönderir.
    """
    smtp_server = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("MAIL_PORT", "587"))
    username = os.getenv("MAIL_USERNAME")
    password = os.getenv("MAIL_PASSWORD")
    mail_from = os.getenv("MAIL_FROM")

    if not username or "buraya" in username:
        print("UYARI: Mail bilgileri .env dosyasında eksik! Mail gönderilemedi.")
        return

    msg = MIMEMultipart()
    msg['From'] = mail_from
    msg['To'] = to_email
    msg['Subject'] = "Komşum Uygulaması - E-posta Doğrulama"

    body = f"""
    <h3>Hoşgeldiniz!</h3>
    <p>Komşum uygulamasına kaydınız alındı. Lütfen aşağıdaki linke tıklayarak hesabınızı doğrulayın:</p>
    <a href="{verify_link}" style="padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Hesabımı Doğrula</a>
    <p>veya linki tarayıcınıza yapıştırın: {verify_link}</p>
    <br>
    <p>Sevgiler,<br>Komşum Ekibi</p>
    """
    msg.attach(MIMEText(body, 'html'))

    try:
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls() # Güvenli bağlantı
        server.login(username, password)
        text = msg.as_string()
        server.sendmail(username, to_email, text)
        server.quit()
    except Exception as e:
        print(f"SMTP Hatası: {e}")
        # raise e # Hata fırlatıp akışı kesmesin

def send_reset_password_email(to_email: str, reset_link: str):
    """
    Şifre sıfırlama linki e-postası gönderir.
    """
    smtp_server = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("MAIL_PORT", "587"))
    username = os.getenv("MAIL_USERNAME")
    password = os.getenv("MAIL_PASSWORD")
    mail_from = os.getenv("MAIL_FROM")

    if not username or "buraya" in username:
        print("UYARI: Mail bilgileri .env dosyasında eksik! Mail gönderilemedi.")
        return

    msg = MIMEMultipart()
    msg['From'] = mail_from
    msg['To'] = to_email
    msg['Subject'] = "Komşum Uygulaması - Şifre Sıfırlama"

    body = f"""
    <h3>Şifre Sıfırlama Talebi</h3>
    <p>Hesabınız için şifre sıfırlama talebinde bulundunuz. Aşağıdaki butona tıklayarak yeni şifrenizi belirleyebilirsiniz:</p>
    <a href="{reset_link}" style="padding: 10px 20px; background-color: #FF6B35; color: white; text-decoration: none; border-radius: 5px;">Şifremi Sıfırla</a>
    <p>veya linki tarayıcınıza yapıştırın: {reset_link}</p>
    <p><strong>Bu link 15 dakika geçerlidir.</strong></p>
    <p>Eğer bu talebi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
    <br>
    <p>Sevgiler,<br>Komşum Ekibi</p>
    """
    msg.attach(MIMEText(body, 'html'))

    try:
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(username, password)
        text = msg.as_string()
        server.sendmail(username, to_email, text)
        server.quit()
    except Exception as e:
        print(f"SMTP Hatası: {e}")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    return get_user_from_access_token(token, db)

def verify_admin_access(current_user: Kullanici = Depends(get_current_user)):
    """
    Sadece Admin yetkisine sahip kullanıcıların erişimine izin verir.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu işlem için yetkiniz yok (Admin only)")

    return current_user
