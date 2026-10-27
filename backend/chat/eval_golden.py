"""A4 — golden set for retrieval evaluation.

Each case is a realistic user question and the catalog slug(s) a correct retrieval must
return. Questions are written the way people actually ask (short, informal, three
languages) and are deliberately NOT copied from scenario titles, so the set measures
matching rather than string equality. Extend this list whenever a 👎 or a catalog gap
reveals a miss — the harness then guards against regressions.
"""

GOLDEN = [
    # identity documents
    {"q": "My passport expires next month, how do I get a new one?", "lang": "en", "expect": ["passport-renewal"]},
    {"q": "Как поменять паспорт, если срок заканчивается?", "lang": "ru", "expect": ["passport-renewal"]},
    {"q": "Pasportim yo'qolib qoldi, nima qilaman?", "lang": "uz", "expect": ["lost-passport"]},
    {"q": "I lost my passport", "lang": "en", "expect": ["lost-passport"]},
    {"q": "Как получить ID-карту?", "lang": "ru", "expect": ["id-card-issuance"]},
    {"q": "Bolaga tug'ilganlik guvohnomasi qanday olinadi?", "lang": "uz", "expect": ["birth-certificate", "newborn-registration"]},
    {"q": "Где зарегистрировать брак?", "lang": "ru", "expect": ["marriage-registration"]},
    # business
    {"q": "How to open an LLC company?", "lang": "en", "expect": ["register-llc"]},
    {"q": "Как стать индивидуальным предпринимателем?", "lang": "ru", "expect": ["sole-proprietor-registration"]},
    {"q": "Do I need a license for my business?", "lang": "en", "expect": ["business-license"]},
    {"q": "Как закрыть фирму?", "lang": "ru", "expect": ["close-company"]},
    # taxes
    {"q": "How do I get a tax identification number?", "lang": "en", "expect": ["personal-tin"]},
    {"q": "Soliq deklaratsiyasini qanday topshiraman?", "lang": "uz", "expect": ["tax-declaration"]},
    {"q": "IT Park residents tax benefits", "lang": "en", "expect": ["itpark-tax-benefits"]},
    {"q": "Как оплатить налоги онлайн?", "lang": "ru", "expect": ["pay-taxes-online"]},
    # health
    {"q": "What number do I call for an ambulance?", "lang": "en", "expect": ["emergency-medical"]},
    {"q": "Нужна медицинская справка для водительских прав", "lang": "ru", "expect": ["medical-certificate-driving", "driving-medical-check"]},
    {"q": "Vaktsina sertifikatini qayerdan olaman?", "lang": "uz", "expect": ["vaccination-certificate"]},
    # visa & migration
    {"q": "Do I need a visa to visit Uzbekistan as a tourist?", "lang": "en", "expect": ["tourist-visa"]},
    {"q": "Как продлить электронную визу?", "lang": "ru", "expect": ["evisa-extension"]},
    {"q": "How can a foreigner get a work permit?", "lang": "en", "expect": ["work-permit"]},
    {"q": "Вид на жительство для иностранца", "lang": "ru", "expect": ["residence-permit"]},
    {"q": "How to become a citizen of Uzbekistan", "lang": "en", "expect": ["citizenship"]},
    # transport
    {"q": "How do I get a driver's license?", "lang": "en", "expect": ["drivers-license"]},
    {"q": "Как поставить машину на учёт?", "lang": "ru", "expect": ["vehicle-registration"]},
    {"q": "Jarimani qanday to'layman?", "lang": "uz", "expect": ["pay-traffic-fines"]},
    # residence
    {"q": "Tourist arrived in Tashkent, how to register temporary stay?", "lang": "en", "expect": ["temporary-residence-registration"]},
    {"q": "Как сменить адрес прописки?", "lang": "ru", "expect": ["change-registered-address", "permanent-residence-registration"]},
    {"q": "How do I deregister from my address?", "lang": "en", "expect": ["deregistration"]},
]
