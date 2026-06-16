from slowapi import Limiter
from slowapi.util import get_remote_address

# IP adresine göre istek sınırlama
limiter = Limiter(key_func=get_remote_address)
