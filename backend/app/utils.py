import unicodedata
import re

def tr_normalize(text: str) -> str:
    """
    Türkçe karakterleri İngilizce karşılıklarına çevirir ve küçük harf yapar.
    Şükran -> sukran
    Çiğdem -> cigdem
    """
    if not text:
        return ""
    
    # Önce manuel değişimler
    text = text.replace("İ", "i").replace("I", "ı").replace("ı", "i")
    text = text.replace("Ğ", "g").replace("ğ", "g")
    text = text.replace("Ü", "u").replace("ü", "u")
    text = text.replace("Ş", "s").replace("ş", "s")
    text = text.replace("Ö", "o").replace("ö", "o")
    text = text.replace("Ç", "c").replace("ç", "c")
    
    # Standart normalizasyon
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('utf-8')
    
    return text.lower().strip()



def validate_password_strength(password: str) -> str:
    """
    Şifre karmaşıklığını kontrol eder. Hata varsa hata mesajı döner, yoksa None döner.
    """
    if len(password) < 8:
        return "Şifre en az 8 karakter olmalıdır"
    if not re.search("[A-Z]", password):
        return "Şifre en az bir büyük harf içermelidir"
    if not re.search("[a-z]", password):
        return "Şifre en az bir küçük harf içermelidir"
    if not re.search("[0-9]", password):
        return "Şifre en az bir rakam içermelidir"
    if not re.search("[!@#$%^&*(),.?\":{}|<>]", password):
        return "Şifre en az bir özel karakter içermelidir (!@#$%^&*...)"
    return None
