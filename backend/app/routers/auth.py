from fastapi import APIRouter, Depends, HTTPException, Request, status
from app.rate_limiter import limiter
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Kullanici, Mahalle, KaraListeToken, RefreshToken
from app.schemas import KullaniciCreate, KullaniciRead, ResetPasswordRequest
from app.auth import get_password_hash, create_access_token, create_refresh_token, verify_password, send_verification_email, send_reset_password_email, ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS, get_current_user, oauth2_scheme, SECRET_KEY, ALGORITHM
from app.utils import tr_normalize, validate_password_strength
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import HTMLResponse
import datetime
import os
import socket
from jose import jwt, JWTError

router = APIRouter(
    prefix="/auth",
    tags=["Auth"]
)

@router.post("/register", response_model=KullaniciRead)
@limiter.limit("5/hour")
def register(request: Request, user: KullaniciCreate, db: Session = Depends(get_db)):
    db_user = db.query(Kullanici).filter(Kullanici.eposta == user.eposta).first()
    if db_user:
        raise HTTPException(status_code=400, detail="E-posta zaten kayıtlı")

    mahalle = db.query(Mahalle).filter(Mahalle.id == user.mahalle_id).first()
    if not mahalle:
        raise HTTPException(status_code=400, detail="Geçersiz mahalle seçimi")

    hashed_password = get_password_hash(user.password)

    yeni_kullanici = Kullanici(
        ad=user.ad,
        soyad=user.soyad,
        eposta=user.eposta,
        mahalle_id=user.mahalle_id,
        password_hash=hashed_password,
        is_verified=False,
        arama_metni=tr_normalize(f"{user.ad} {user.soyad}")
    )
    db.add(yeni_kullanici)
    db.commit()
    db.refresh(yeni_kullanici)

    verify_token = create_access_token(data={"sub": user.eposta, "type": "verify"}, expires_delta=datetime.timedelta(hours=24))
    try:
        local_ip = socket.gethostbyname(socket.gethostname())
    except Exception:
        local_ip = "127.0.0.1"
    app_url = os.getenv("APP_URL", f"http://{local_ip}:8000")
    verify_link = f"{app_url}/auth/verify-email?token={verify_token}" 
    
    try:
        send_verification_email(user.eposta, verify_link)
        print(f"✅ Doğrulama maili gönderildi: {user.eposta}")
    except Exception as e:
        print(f"❌ Mail gönderme hatası: {e}")

    return yeni_kullanici

@router.post("/login")
@limiter.limit("10/minute")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(Kullanici).filter(Kullanici.eposta == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Hatalı e-posta veya şifre",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_verified:
        raise HTTPException(status_code=400, detail="Lütfen önce e-posta adresinizi doğrulayın.")

    access_token_expires = datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.eposta}, expires_delta=access_token_expires
    )
    
    # Refresh token oluştur ve veritabanına kaydet
    refresh_token_str, refresh_expire = create_refresh_token(data={"sub": user.eposta})
    yeni_refresh = RefreshToken(
        token=refresh_token_str,
        kullanici_id=user.id,
        son_kullanma=refresh_expire
    )
    db.add(yeni_refresh)
    db.commit()
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token_str,
        "token_type": "bearer"
    }

@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if email is None or token_type != "verify":
            raise HTTPException(status_code=400, detail="Geçersiz token")
            
    except JWTError:
        raise HTTPException(status_code=400, detail="Geçersiz veya süresi dolmuş token")
    
    user = db.query(Kullanici).filter(Kullanici.pending_email == email).first()
    if not user:
        user = db.query(Kullanici).filter(Kullanici.eposta == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    if user.pending_email and user.pending_email == email:
        eski_eposta = user.eposta
        user.eposta = user.pending_email
        user.pending_email = None
        user.is_verified = True
        db.commit()
        message_title = "✅ Başarılı!"
        message_body = f"E-posta adresiniz {eski_eposta} yerine başarıyla güncellendi.<br>Artık uygulamaya yeni e-posta adresinizle giriş yapabilirsiniz."
        color = "#4CAF50"
    elif user.is_verified:
        message_title = "ℹ️ Zaten Doğrulanmış"
        message_body = "E-posta adresiniz zaten daha önce doğrulanmış.<br>Uygulamaya giriş yapabilirsiniz."
        color = "#2196F3" # Mavi
    else:
        user.is_verified = True
        db.commit()
        message_title = "✅ Başarılı!"
        message_body = "E-posta adresiniz başarıyla doğrulandı.<br>Artık uygulamaya giriş yapabilirsiniz."
        color = "#4CAF50" # Yeşil

    html_content = f"""
    <html>
        <head>
            <title>Komşum - E-posta Doğrulama</title>
            <style>
                body {{
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background-color: #f0f2f5;
                }}
                .container {{
                    text-align: center;
                    background: white;
                    padding: 40px;
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    max-width: 400px;
                    width: 90%;
                }}
                h1 {{ color: {color}; margin-bottom: 20px; }}
                p {{ color: #555; font-size: 18px; line-height: 1.5; }}
                .btn {{
                    display: inline-block;
                    margin-top: 25px;
                    padding: 12px 24px;
                    background-color: {color};
                    color: white;
                    text-decoration: none;
                    border-radius: 6px;
                    font-weight: bold;
                    transition: background-color 0.3s;
                }}
                .btn:hover {{ opacity: 0.9; }}
            </style>
        </head>
        <body>
            <div class="container">
                <h1>{message_title}</h1>
                <p>{message_body}</p>
            </div>
        </body>
    </html>
    """
    return HTMLResponse(content=html_content, status_code=200)

@router.post("/forgot-password")
@limiter.limit("3/hour")
def forgot_password(request: Request, eposta: str, db: Session = Depends(get_db)):
    """E-posta adresine şifre sıfırlama linki gönderir"""
    user = db.query(Kullanici).filter(Kullanici.eposta == eposta).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="E-posta kayıtlı değil")
    
    # 15 dakikalık reset token oluştur
    reset_token = create_access_token(
        data={"sub": user.eposta, "type": "reset"},
        expires_delta=datetime.timedelta(minutes=15)
    )
    
    try:
        local_ip = socket.gethostbyname(socket.gethostname())
    except Exception:
        local_ip = "127.0.0.1"
    app_url = os.getenv("APP_URL", f"http://{local_ip}:8000")
    reset_link = f"{app_url}/auth/reset-password-page?token={reset_token}"
    send_reset_password_email(user.eposta, reset_link)
    
    return {"mesaj": "Şifre sıfırlama linki gönderildi."}

@router.get("/reset-password-page")
def reset_password_page(token: str):
    """Şifre sıfırlama formu sayfası"""
    html_content = f"""
    <html>
        <head>
            <title>Komşum - Şifre Sıfırlama</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #FF6B35, #F7931E);">
            <div style="background: white; padding: 40px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); text-align: center; max-width: 400px; width: 90%;">
                <h2 style="color: #FF6B35;">🔐 Yeni Şifre Belirle</h2>
                <div id="success-container" style="display: none; text-align: center; animation: fadeIn 0.5s;">
                    <div style="font-size: 60px; margin-bottom: 15px;">🎉</div>
                    <h3 style="color: #4CAF50; margin: 10px 0;">Şifreniz Güncellendi!</h3>
                    <p id="success-message" style="color: #555; font-size: 16px; margin-bottom: 20px;"></p>
                    <p style="color: #888; font-size: 14px;">Artık uygulamaya dönüp yeni şifrenizle giriş yapabilirsiniz.</p>
                </div>

                <form id="resetForm">
                    <input type="password" id="yeni_sifre" placeholder="Yeni Şifre" required
                        style="width: 100%; padding: 12px; margin: 8px 0; border: 2px solid #ddd; border-radius: 8px; box-sizing: border-box; font-size: 14px;">
                    <input type="password" id="sifre_tekrar" placeholder="Yeni Şifre (Tekrar)" required
                        style="width: 100%; padding: 12px; margin: 8px 0; border: 2px solid #ddd; border-radius: 8px; box-sizing: border-box; font-size: 14px;">
                    <p id="error" style="color: red; display: none; margin-top: 10px;"></p>
                    <button type="submit" style="width: 100%; padding: 12px; background-color: #FF6B35; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; margin-top: 10px; font-weight: bold; transition: background 0.3s;">
                        Şifremi Güncelle
                    </button>
                </form>
                <script>
                    document.getElementById('resetForm').addEventListener('submit', async function(e) {{
                        e.preventDefault();
                        const yeniSifre = document.getElementById('yeni_sifre').value;
                        const sifreTekrar = document.getElementById('sifre_tekrar').value;
                        const errorEl = document.getElementById('error');
                        const successContainer = document.getElementById('success-container');
                        const successMsg = document.getElementById('success-message');
                        const form = document.getElementById('resetForm');
                        
                        errorEl.style.display = 'none';
                        
                        if (yeniSifre !== sifreTekrar) {{
                            errorEl.textContent = 'Şifreler eşleşmiyor!';
                            errorEl.style.display = 'block';
                            return;
                        }}
                        
                        // Butonu loading durumuna getir
                        const btn = form.querySelector('button');
                        const originalText = btn.textContent;
                        btn.textContent = 'Güncelleniyor...';
                        btn.disabled = true;
                        btn.style.opacity = '0.7';
                        
                        try {{
                            const response = await fetch('/auth/reset-password', {{
                                method: 'POST',
                                headers: {{
                                    'Content-Type': 'application/json'
                                }},
                                body: JSON.stringify({{
                                    token: '{token}',
                                    yeni_sifre: yeniSifre
                                }})
                            }});
                            const data = await response.json();
                            
                            if (response.ok) {{
                                successMsg.textContent = data.mesaj;
                                form.style.display = 'none';
                                document.querySelector('h2').style.display = 'none'; // Başlığı da gizle
                                successContainer.style.display = 'block';
                            }} else {{
                                errorEl.textContent = data.detail || 'Bir hata oluştu';
                                errorEl.style.display = 'block';
                                btn.textContent = originalText;
                                btn.disabled = false;
                                btn.style.opacity = '1';
                            }}
                        }} catch (err) {{
                            errorEl.textContent = 'Bağlantı hatası';
                            errorEl.style.display = 'block';
                            btn.textContent = originalText;
                            btn.disabled = false;
                            btn.style.opacity = '1';
                        }}
                    }});
                </script>
                <style>
                    @keyframes fadeIn {{
                        from {{ opacity: 0; transform: translateY(10px); }}
                        to {{ opacity: 1; transform: translateY(0); }}
                    }}
                    input:focus {{ outline: none; border-color: #FF6B35 !important; }}
                    button:hover {{ background-color: #e55a2b !important; }}
                </style>
            </div>
        </body>
    </html>
    """
    return HTMLResponse(content=html_content, status_code=200)

@router.post("/reset-password")
@limiter.limit("5/hour")
def reset_password(request: Request, payload_data: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Şifre sıfırlama token'ı ile yeni şifre belirle"""
    token = payload_data.token
    yeni_sifre = payload_data.yeni_sifre
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if email is None or token_type != "reset":
            raise HTTPException(status_code=400, detail="Geçersiz şifre sıfırlama linki")
    except JWTError:
        raise HTTPException(status_code=400, detail="Geçersiz veya süresi dolmuş şifre sıfırlama linki")
    
    user = db.query(Kullanici).filter(Kullanici.eposta == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    password_error = validate_password_strength(yeni_sifre)
    if password_error:
        raise HTTPException(status_code=400, detail=password_error)
    
    if verify_password(yeni_sifre, user.password_hash):
        raise HTTPException(status_code=400, detail="Yeni şifreniz mevcut şifrenizle aynı olamaz.")
    
    user.password_hash = get_password_hash(yeni_sifre)
    db.commit()
    
    return {"mesaj": "Şifreniz başarıyla güncellendi. Artık yeni şifrenizle giriş yapabilirsiniz."}

@router.post("/refresh")
@limiter.limit("30/minute")
def refresh_access_token(request: Request, refresh_token: str, db: Session = Depends(get_db)):
    """Refresh token ile yeni access token al"""
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if email is None or token_type != "refresh":
            raise HTTPException(status_code=401, detail="Geçersiz refresh token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Geçersiz veya süresi dolmuş refresh token")
    
    # Veritabanında refresh token kontrolü
    db_refresh = db.query(RefreshToken).filter(
        RefreshToken.token == refresh_token,
        RefreshToken.iptal_edildi == False
    ).first()
    
    if not db_refresh:
        raise HTTPException(status_code=401, detail="Refresh token geçersiz veya iptal edilmiş")
    
    # Yeni access token oluştur
    access_token = create_access_token(data={"sub": email})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/logout")
@limiter.limit("10/minute")
def logout(
    request: Request,
    token: str = Depends(oauth2_scheme),
    current_user: Kullanici = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Access token'ı kara listeye ekle
    kara_token = KaraListeToken(token=token)
    db.add(kara_token)
    
    # Kullanıcının tüm aktif refresh token'larını iptal et
    db.query(RefreshToken).filter(
        RefreshToken.kullanici_id == current_user.id,
        RefreshToken.iptal_edildi == False
    ).update({"iptal_edildi": True})
    
    db.commit()
    return {"mesaj": "Başarıyla çıkış yapıldı. Tüm tokenlar geçersiz kılındı."}
