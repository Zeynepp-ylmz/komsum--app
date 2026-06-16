from dotenv import load_dotenv
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# .env dosyasını yüklemeyi dene
load_dotenv()

def test_email_sending():
    print("--- MAİL GÖNDERME TESTİ ---")
    
    # 1. Bilgileri Oku
    smtp_server = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("MAIL_PORT", "587"))
    username = os.getenv("MAIL_USERNAME")
    password = os.getenv("MAIL_PASSWORD")
    mail_from = os.getenv("MAIL_FROM")
    
    print(f"Server: {smtp_server}:{smtp_port}")
    print(f"Kullanıcı: {username}")
    print(f"Şifre: {'*' * len(password) if password else 'YOK'}")
    print(f"Gönderen: {mail_from}")

    if not username or not password:
        print("❌ HATA: Kullanıcı adı veya şifre .env dosyasından okunamadı!")
        return

    # 2. Gönderilecek Adresi İste
    to_email = input("Test maili kime gönderilsin? (E-posta girin): ").strip()
    if not to_email:
        print("E-posta girmediniz.")
        return

    # 3. Mail Hazırla
    msg = MIMEMultipart()
    msg['From'] = mail_from or username
    msg['To'] = to_email
    msg['Subject'] = "Komşum Test Maili (Manuel Test)"
    body = "<h3>Merhaba!</h3><p>Bu bir test mailidir. Eğer bunu görüyorsan ayarlar doğru demektir. ✅</p>"
    msg.attach(MIMEText(body, 'html'))

    # 4. Gönder
    try:
        print("\nBağlanılıyor...")
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.set_debuglevel(1) # Detaylı logları aç
        
        print("STARTTLS yapılıyor...")
        server.starttls()
        
        print("Giriş yapılıyor...")
        server.login(username, password)
        
        print("Mail gönderiliyor...")
        text = msg.as_string()
        server.sendmail(username, to_email, text)
        
        server.quit()
        print("\n✅ BAŞARILI! Mail gönderildi (Spam kutusunu da kontrol edin).")
    except Exception as e:
        print(f"\n❌ BAŞARISIZ! Hata detayı:\n{e}")

if __name__ == "__main__":
    test_email_sending()
