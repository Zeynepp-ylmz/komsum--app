from app.database import SessionLocal
from app.models import Il, Ilce, Mahalle

LOCATION_DATA = {
    "İstanbul": {
        "Kadıköy": [
            "Caferağa",
            "Osmanağa",
            "Rasimpaşa",
            "Moda",
            "Fenerbahçe",
        ],
        "Üsküdar": [
            "Altunizade",
            "Kuzguncuk",
            "Acıbadem",
            "Beylerbeyi",
            "Çengelköy",
        ],
        "Beşiktaş": [
            "Levent",
            "Etiler",
            "Ortaköy",
            "Abbasağa",
            "Bebek",
        ],
         "Bağcılar": [
        "Yenimahalle",
        "Güneşli",
        "Mahmutbey",
        "Kirazlı",
        "Fevzi Çakmak",
        ],
    
    },
    "Ankara": {
        "Çankaya": [
            "Kızılay",
            "Bahçelievler",
            "Ayrancı",
            "Emek",
            "Dikmen",
        ],
        "Keçiören": [
            "Etlik",
            "Aktepe",
            "Şenlik",
            "Ufuktepe",
            "Kalaba",
        ],
        "Yenimahalle": [
            "Batıkent",
            "Demetevler",
            "İvedik",
            "Karşıyaka",
            "Ragıp Tüzün",
        ],
    },
    "İzmir": {
        "Konak": [
            "Alsancak",
            "Göztepe",
            "Güzelyalı",
            "Kemeraltı",
            "Hatay",
        ],
        "Karşıyaka": [
            "Bostanlı",
            "Mavişehir",
            "Alaybey",
            "Bahariye",
            "Nergiz",
        ],
        "Bornova": [
            "Kazımdirik",
            "Erzene",
            "Atatürk",
            "Mevlana",
            "İnönü",
        ],
    },
}


def get_or_create_il(db, il_adi: str):
    il = db.query(Il).filter(Il.ad == il_adi).first()
    if il:
        return il

    il = Il(ad=il_adi)
    db.add(il)
    db.commit()
    db.refresh(il)
    return il


def get_or_create_ilce(db, ilce_adi: str, il_id: int):
    ilce = (
        db.query(Ilce)
        .filter(Ilce.ad == ilce_adi, Ilce.il_id == il_id)
        .first()
    )
    if ilce:
        return ilce

    ilce = Ilce(ad=ilce_adi, il_id=il_id)
    db.add(ilce)
    db.commit()
    db.refresh(ilce)
    return ilce


def get_or_create_mahalle(db, mahalle_adi: str, ilce_id: int, sehir: str):
    mahalle = (
        db.query(Mahalle)
        .filter(Mahalle.ad == mahalle_adi, Mahalle.ilce_id == ilce_id)
        .first()
    )
    if mahalle:
        return mahalle

    mahalle = Mahalle(
        ad=mahalle_adi,
        sehir=sehir,
        ilce_id=ilce_id,
    )
    db.add(mahalle)
    db.commit()
    db.refresh(mahalle)
    return mahalle


def seed_locations():
    db = SessionLocal()

    try:
        for il_adi, ilceler in LOCATION_DATA.items():
            il = get_or_create_il(db, il_adi)

            for ilce_adi, mahalleler in ilceler.items():
                ilce = get_or_create_ilce(db, ilce_adi, il.id)

                for mahalle_adi in mahalleler:
                    get_or_create_mahalle(db, mahalle_adi, ilce.id, il_adi)

        print("Şehir, ilçe ve mahalle verileri başarıyla eklendi.")

    finally:
        db.close()


if __name__ == "__main__":
    seed_locations()