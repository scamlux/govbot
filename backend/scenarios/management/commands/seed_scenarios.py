"""Seed the Scenario Catalog with realistic, clearly-marked trilingual sample content.

Idempotent: run repeatedly; existing rows are updated in place by slug.

    python manage.py seed_scenarios
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from scenarios.models import Category, Scenario

DISCLAIMER = {
    "uz": "\n\n> ⚠️ **Eslatma:** Bu ma'lumot umumiy tavsif uchun. Aniq talablar, "
    "to'lovlar va muddatlar o'zgarishi mumkin — rasmiy organ bilan tasdiqlang.",
    "ru": "\n\n> ⚠️ **Примечание:** Это общая информация. Точные требования, пошлины и "
    "сроки могут меняться — уточняйте в официальном органе.",
    "en": "\n\n> ⚠️ **Note:** This is general information. Exact requirements, fees and "
    "deadlines may change — confirm with the responsible official agency.",
}

CATEGORIES = [
    {
        "slug": "identity-documents",
        "icon": "🛂",
        "order": 1,
        "name": {"uz": "Hujjatlar va shaxsni tasdiqlash", "ru": "Документы и удостоверения", "en": "Identity & Documents"},
        "description": {
            "uz": "Pasport, ID-karta va tug'ilganlik guvohnomasi xizmatlari.",
            "ru": "Услуги по паспорту, ID-карте и свидетельствам.",
            "en": "Passport, ID card and certificate services.",
        },
    },
    {
        "slug": "business",
        "icon": "🏢",
        "order": 2,
        "name": {"uz": "Biznes va tadbirkorlik", "ru": "Бизнес и предпринимательство", "en": "Business"},
        "description": {
            "uz": "Biznesni ro'yxatdan o'tkazish va litsenziyalar.",
            "ru": "Регистрация бизнеса и лицензии.",
            "en": "Company registration and licensing.",
        },
    },
    {
        "slug": "taxes",
        "icon": "🧾",
        "order": 3,
        "name": {"uz": "Soliqlar", "ru": "Налоги", "en": "Taxes"},
        "description": {
            "uz": "Soliq to'lovlari, deklaratsiya va STIR.",
            "ru": "Налоговые платежи, декларации и ИНН.",
            "en": "Tax payments, declarations and TIN.",
        },
    },
    {
        "slug": "healthcare",
        "icon": "🏥",
        "order": 4,
        "name": {"uz": "Sog'liqni saqlash", "ru": "Здравоохранение", "en": "Healthcare"},
        "description": {
            "uz": "Tibbiy xizmatlar va sug'urta.",
            "ru": "Медицинские услуги и страхование.",
            "en": "Medical services and insurance.",
        },
    },
    {
        "slug": "visa-migration",
        "icon": "✈️",
        "order": 5,
        "name": {"uz": "Viza va migratsiya", "ru": "Виза и миграция", "en": "Visa & Migration"},
        "description": {
            "uz": "Viza, ro'yxatga olish va yashash ruxsatnomalari.",
            "ru": "Визы, регистрация и виды на жительство.",
            "en": "Visas, registration and residence permits.",
        },
    },
    {
        "slug": "transport",
        "icon": "🚗",
        "order": 6,
        "name": {"uz": "Transport", "ru": "Транспорт", "en": "Transport"},
        "description": {
            "uz": "Haydovchilik guvohnomasi va avtomobil ro'yxati.",
            "ru": "Водительские права и регистрация авто.",
            "en": "Driving licences and vehicle registration.",
        },
    },
    {
        "slug": "residence",
        "icon": "🏠",
        "order": 7,
        "name": {"uz": "Yashash joyi ro'yxati", "ru": "Регистрация по месту жительства", "en": "Residence Registration"},
        "description": {
            "uz": "Propiska va manzilni ro'yxatga olish.",
            "ru": "Прописка и регистрация адреса.",
            "en": "Address and residence registration.",
        },
    },
]

SCENARIOS = [{'slug': 'passport-renewal',
  'category': 'identity-documents',
  'tags': ['passport', 'biometric', 'renewal'],
  'order': 1,
  'source_url': 'https://my.gov.uz',
  'title': {'uz': 'Biometrik pasportni yangilash',
            'ru': 'Замена биометрического паспорта',
            'en': 'Renewing a Biometric Passport'},
  'body': {'uz': '## Biometrik pasportni yangilash\n'
                 '\n'
                 'Biometrik pasportni amal qilish muddati tugashidan oldin yoki sahifalari '
                 'tugaganda yangilang. Onlayn navbat oling va xizmat markaziga tashrif buyuring.\n'
                 '\n'
                 '**Kim:** muddati tugayotgan yoki toʻlgan pasportga ega Oʻzbekiston fuqarolari.\n'
                 '**Hujjatlar:** amaldagi pasport, ID-karta va yangi surat.\n'
                 '\n'
                 '1. my.gov.uz orqali onlayn ariza bering.\n'
                 '2. Davlat bojini toʻlang (oʻzgarishi mumkin — organ bilan tasdiqlang).\n'
                 '3. Xizmat markazida biometriya topshiring.\n'
                 '4. Yangi pasportni oling.\n'
                 '\n'
                 "**Mas'ul organ:** IIV / Davlat xizmatlari agentligi.",
           'ru': '## Замена биометрического паспорта\n'
                 '\n'
                 'Замените биометрический паспорт до окончания срока действия или когда '
                 'закончились страницы. Запишитесь онлайн и посетите центр госуслуг.\n'
                 '\n'
                 '**Кто:** граждане Узбекистана с истекающим или заполненным паспортом.\n'
                 '**Документы:** действующий паспорт, ID-карта и свежее фото.\n'
                 '\n'
                 '1. Подайте заявку онлайн на my.gov.uz.\n'
                 '2. Оплатите госпошлину (может отличаться — уточните в органе).\n'
                 '3. Сдайте биометрию в центре госуслуг.\n'
                 '4. Получите новый паспорт.\n'
                 '\n'
                 '**Ответственный орган:** МВД / Агентство государственных услуг.',
           'en': '## Renewing a Biometric Passport\n'
                 '\n'
                 'Renew your biometric passport before it expires or when pages run out. Book an '
                 'appointment online and visit your local service centre.\n'
                 '\n'
                 '**Who:** Uzbek citizens with an expiring or full passport.\n'
                 '**Documents:** current passport, ID card, and a recent photo.\n'
                 '\n'
                 '1. Apply online via my.gov.uz.\n'
                 '2. Pay the state fee (may vary — confirm with the agency).\n'
                 '3. Submit biometrics at the service centre.\n'
                 '4. Collect your new passport.\n'
                 '\n'
                 '**Responsible body:** Ministry of Internal Affairs / Public Services Agency.'}},
 {'slug': 'id-card-issuance',
  'category': 'identity-documents',
  'tags': ['id-card', 'identity', 'issuance'],
  'order': 2,
  'source_url': 'https://my.gov.uz',
  'title': {'uz': 'Milliy ID-kartani olish',
            'ru': 'Получение национальной ID-карты',
            'en': 'Getting a National ID Card'},
  'body': {'uz': '## Milliy ID-kartani olish\n'
                 '\n'
                 'ID-karta fuqarolar va rezidentlar uchun asosiy shaxsni tasdiqlovchi hujjatdir. '
                 'Birinchi karta, almashtirish yoki yangilash uchun ariza bering.\n'
                 '\n'
                 '**Kim:** kerakli yoshga yetgan fuqarolar va rezidentlar.\n'
                 '**Hujjatlar:** tugʻilganlik guvohnomasi yoki eski ID, manzil tasdigʻi va surat.\n'
                 '\n'
                 '1. my.gov.uz da soʻrov rasmiylashtiring.\n'
                 '2. Davlat bojini toʻlang (oʻzgarishi mumkin — organ bilan tasdiqlang).\n'
                 '3. Joyida barmoq izlari va suratni topshiring.\n'
                 '4. ID-kartani oling.\n'
                 '\n'
                 "**Mas'ul organ:** IIV / Davlat xizmatlari agentligi.",
           'ru': '## Получение национальной ID-карты\n'
                 '\n'
                 'ID-карта — основной документ, удостоверяющий личность граждан и резидентов. '
                 'Оформите первую карту, замену или продление.\n'
                 '\n'
                 '**Кто:** граждане, достигшие нужного возраста, и резиденты.\n'
                 '**Документы:** свидетельство о рождении или старая ID, подтверждение адреса и '
                 'фото.\n'
                 '\n'
                 '1. Оформите запрос на my.gov.uz.\n'
                 '2. Оплатите госпошлину (может отличаться — уточните в органе).\n'
                 '3. Сдайте отпечатки пальцев и фото на месте.\n'
                 '4. Получите ID-карту.\n'
                 '\n'
                 '**Ответственный орган:** МВД / Агентство государственных услуг.',
           'en': '## Getting a National ID Card\n'
                 '\n'
                 'The ID card is the main identity document for citizens and residents. Apply for '
                 'a first card, a replacement, or a renewal.\n'
                 '\n'
                 '**Who:** citizens reaching the required age and residents.\n'
                 '**Documents:** birth certificate or old ID, proof of address, and a photo.\n'
                 '\n'
                 '1. Register your request on my.gov.uz.\n'
                 '2. Pay the state fee (may vary — confirm with the agency).\n'
                 '3. Give fingerprints and a photo on site.\n'
                 '4. Receive your ID card.\n'
                 '\n'
                 '**Responsible body:** Ministry of Internal Affairs / Public Services Agency.'}},
 {'slug': 'birth-certificate',
  'category': 'identity-documents',
  'tags': ['birth', 'certificate', 'zags'],
  'order': 3,
  'source_url': 'https://my.gov.uz',
  'title': {'uz': 'Tugʻilishni qayd etish',
            'ru': 'Регистрация рождения',
            'en': 'Registering a Birth'},
  'body': {'uz': '## Tugʻilishni qayd etish\n'
                 '\n'
                 'Chaqaloqni qayd eting va bolaning birinchi rasmiy hujjati — tugʻilganlik '
                 'guvohnomasini oling. Qayd etish odatda tugʻilgandan koʻp oʻtmay amalga '
                 'oshiriladi.\n'
                 '\n'
                 '**Kim:** ota-ona yoki qonuniy vakil.\n'
                 "**Hujjatlar:** tugʻilganlik tibbiy ma'lumotnomasi, ota-ona pasportlari va mavjud "
                 'boʻlsa nikoh guvohnomasi.\n'
                 '\n'
                 '1. FHDYo boʻlimiga murojaat qiling yoki my.gov.uz orqali bering.\n'
                 "2. Tibbiy ma'lumotnoma va ota-ona hujjatlarini topshiring.\n"
                 "3. Bolaning ismi va ma'lumotlarini tanlang.\n"
                 '4. Tugʻilganlik guvohnomasini oling.\n'
                 '\n'
                 "**Mas'ul organ:** Fuqarolik holati dalolatnomalarini yozish boʻlimi (FHDYo / "
                 'ZAGS).',
           'ru': '## Регистрация рождения\n'
                 '\n'
                 'Зарегистрируйте новорождённого, чтобы получить свидетельство о рождении — первый '
                 'официальный документ ребёнка. Регистрация обычно проводится вскоре после '
                 'рождения.\n'
                 '\n'
                 '**Кто:** родители или законный представитель.\n'
                 '**Документы:** медицинская справка о рождении, паспорта родителей и '
                 'свидетельство о браке при наличии.\n'
                 '\n'
                 '1. Обратитесь в ЗАГС или подайте через my.gov.uz.\n'
                 '2. Предоставьте медсправку и документы родителей.\n'
                 '3. Выберите имя и данные ребёнка.\n'
                 '4. Получите свидетельство о рождении.\n'
                 '\n'
                 '**Ответственный орган:** отдел ЗАГС (ЗАГС / ФХДЁ).',
           'en': '## Registering a Birth\n'
                 '\n'
                 "Register a newborn to receive the birth certificate, the child's first official "
                 'document. Registration is normally done soon after birth.\n'
                 '\n'
                 '**Who:** parents or a legal representative.\n'
                 "**Documents:** medical birth record, parents' passports, and marriage "
                 'certificate if available.\n'
                 '\n'
                 '1. Apply at the ZAGS office or via my.gov.uz.\n'
                 "2. Submit the medical record and parents' documents.\n"
                 "3. Choose the child's name and details.\n"
                 '4. Receive the birth certificate.\n'
                 '\n'
                 '**Responsible body:** Civil Registry Office (ZAGS / FHDYo).'}},
 {'slug': 'marriage-registration',
  'category': 'identity-documents',
  'tags': ['marriage', 'zags', 'registration'],
  'order': 4,
  'source_url': 'https://my.gov.uz',
  'title': {'uz': 'Nikohni qayd etish', 'ru': 'Регистрация брака', 'en': 'Registering a Marriage'},
  'body': {'uz': '## Nikohni qayd etish\n'
                 '\n'
                 'Er-xotin nikoh guvohnomasini olish uchun FHDYo boʻlimida nikohni qayd etadi. '
                 'Sanani oldindan band qiling va birga keling.\n'
                 '\n'
                 '**Kim:** nikohda boʻlmagan ikki balogʻatga yetgan shaxs.\n'
                 '**Hujjatlar:** ikkala pasport, ariza va davlat boji toʻlanganini tasdigʻi.\n'
                 '\n'
                 '1. my.gov.uz yoki FHDYo orqali qoʻshma ariza bering.\n'
                 '2. Davlat bojini toʻlang (oʻzgarishi mumkin — organ bilan tasdiqlang).\n'
                 '3. Belgilangan sanada keling.\n'
                 '4. Nikoh guvohnomasini oling.\n'
                 '\n'
                 "**Mas'ul organ:** Fuqarolik holati dalolatnomalarini yozish boʻlimi (FHDYo / "
                 'ZAGS).',
           'ru': '## Регистрация брака\n'
                 '\n'
                 'Пара регистрирует брак в органе ЗАГС для получения свидетельства о браке. '
                 'Забронируйте дату заранее и приходите вместе.\n'
                 '\n'
                 '**Кто:** двое совершеннолетних, не состоящих в браке.\n'
                 '**Документы:** оба паспорта, заявление и подтверждение оплаты госпошлины.\n'
                 '\n'
                 '1. Подайте совместное заявление через my.gov.uz или ЗАГС.\n'
                 '2. Оплатите госпошлину (может отличаться — уточните в органе).\n'
                 '3. Явитесь в назначенную дату.\n'
                 '4. Получите свидетельство о браке.\n'
                 '\n'
                 '**Ответственный орган:** отдел ЗАГС (ЗАГС / ФХДЁ).',
           'en': '## Registering a Marriage\n'
                 '\n'
                 'Couples register their marriage at the ZAGS office to obtain a marriage '
                 'certificate. Book a date in advance and attend together.\n'
                 '\n'
                 '**Who:** two adults who are not already married.\n'
                 '**Documents:** both passports, application, and proof of paid state fee.\n'
                 '\n'
                 '1. Submit a joint application via my.gov.uz or ZAGS.\n'
                 '2. Pay the state fee (may vary — confirm with the agency).\n'
                 '3. Attend on the chosen date.\n'
                 '4. Receive the marriage certificate.\n'
                 '\n'
                 '**Responsible body:** Civil Registry Office (ZAGS / FHDYo).'}},
 {'slug': 'lost-passport',
  'category': 'identity-documents',
  'tags': ['passport', 'lost', 'replacement'],
  'order': 5,
  'source_url': 'https://my.gov.uz',
  'title': {'uz': 'Yoʻqolgan yoki oʻgʻirlangan pasportni almashtirish',
            'ru': 'Замена утерянного или украденного паспорта',
            'en': 'Replacing a Lost or Stolen Passport'},
  'body': {'uz': '## Yoʻqolgan yoki oʻgʻirlangan pasportni almashtirish\n'
                 '\n'
                 "Pasport yoʻqolgan yoki oʻgʻirlangan boʻlsa, suiiste'molning oldini olish uchun "
                 'tez xabar bering va almashtirishga ariza bering. Shoshilinch yordam — 112 raqami '
                 'orqali.\n'
                 '\n'
                 '**Kim:** pasport egasi.\n'
                 '**Hujjatlar:** ID-karta, yoʻqotish toʻgʻrisidagi ariza va surat.\n'
                 '\n'
                 '1. Yoʻqotish haqida politsiyaga yoki 112 ga xabar bering.\n'
                 '2. my.gov.uz orqali almashtirishga ariza bering.\n'
                 '3. Davlat bojini toʻlang (oʻzgarishi mumkin — organ bilan tasdiqlang).\n'
                 '4. Yangi pasportni oling.\n'
                 '\n'
                 "**Mas'ul organ:** IIV / Davlat xizmatlari agentligi.",
           'ru': '## Замена утерянного или украденного паспорта\n'
                 '\n'
                 'Если паспорт утерян или украден, быстро сообщите об этом и оформите замену, '
                 'чтобы избежать злоупотреблений. Экстренная помощь — по номеру 112.\n'
                 '\n'
                 '**Кто:** владелец паспорта.\n'
                 '**Документы:** ID-карта, заявление об утере и фото.\n'
                 '\n'
                 '1. Сообщите об утере в полицию или по номеру 112.\n'
                 '2. Оформите замену через my.gov.uz.\n'
                 '3. Оплатите госпошлину (может отличаться — уточните в органе).\n'
                 '4. Получите новый паспорт.\n'
                 '\n'
                 '**Ответственный орган:** МВД / Агентство государственных услуг.',
           'en': '## Replacing a Lost or Stolen Passport\n'
                 '\n'
                 'If your passport is lost or stolen, report it quickly and apply for a '
                 'replacement to prevent misuse. Emergency help is available on 112.\n'
                 '\n'
                 '**Who:** the passport holder.\n'
                 '**Documents:** ID card, a statement of loss, and a photo.\n'
                 '\n'
                 '1. Report the loss to the police or on 112.\n'
                 '2. Apply for a replacement via my.gov.uz.\n'
                 '3. Pay the state fee (may vary — confirm with the agency).\n'
                 '4. Collect your new passport.\n'
                 '\n'
                 '**Responsible body:** Ministry of Internal Affairs / Public Services Agency.'}},
 {'slug': 'register-llc',
  'category': 'business',
  'tags': ['llc', 'mchj', 'registration', 'startup'],
  'order': 1,
  'source_url': 'https://my.gov.uz',
  'title': {'uz': "Mas'uliyati cheklangan jamiyat (MChJ) tashkil etish",
            'ru': 'Регистрация общества с ограниченной ответственностью (ООО)',
            'en': 'Registering a limited liability company (LLC)'},
  'body': {'uz': "## MChJ ni ro'yxatdan o'tkazish\n"
                 "**Kim uchun:** yuridik shaxs ochmoqchi bo'lgan ta'sischilar.\n"
                 '**Qadamlar:**\n'
                 '1. Nomni tanlang va bandligini tekshiring.\n'
                 "2. Ustav va ta'sischilar qarorini tayyorlang.\n"
                 '3. Arizani davlat portali orqali onlayn topshiring.\n'
                 "4. Ro'yxatdan o'tkazish guvohnomasi va STIRni oling.\n"
                 '\n'
                 "**Muddat:** odatda bir necha ish kuni. **To'lov:** onlayn ariza asosan bepul, "
                 'notarius xizmatlari alohida.\n'
                 '\n'
                 "**Mas'ul organ:** Davlat xizmatlari agentligi.",
           'ru': '## Регистрация ООО\n'
                 '**Для кого:** учредители, открывающие юридическое лицо.\n'
                 '**Шаги:**\n'
                 '1. Выберите название и проверьте доступность.\n'
                 '2. Подготовьте устав и решение учредителей.\n'
                 '3. Подайте заявление онлайн через государственный портал.\n'
                 '4. Получите свидетельство о регистрации и ИНН.\n'
                 '\n'
                 '**Срок:** обычно несколько рабочих дней. **Оплата:** онлайн-заявка в основном '
                 'бесплатна, услуги нотариуса оплачиваются отдельно.\n'
                 '\n'
                 '**Ответственный орган:** Агентство государственных услуг.',
           'en': '## Registering an LLC (MChJ)\n'
                 '**Who it is for:** founders establishing a legal entity.\n'
                 '**Steps:**\n'
                 '1. Choose a company name and check availability.\n'
                 "2. Prepare the charter and founders' decision.\n"
                 '3. Submit the application online through the state portal.\n'
                 '4. Receive the registration certificate and tax ID.\n'
                 '\n'
                 '**Timeframe:** usually a few working days. **Cost:** the online application is '
                 'generally free, while notary services are charged separately.\n'
                 '\n'
                 '**Responsible body:** Public Services Agency.'}},
 {'slug': 'sole-proprietor-registration',
  'category': 'business',
  'tags': ['sole-proprietor', 'self-employed', 'registration'],
  'order': 2,
  'source_url': 'https://soliq.uz',
  'title': {'uz': "Yakka tartibdagi tadbirkor sifatida ro'yxatdan o'tish",
            'ru': 'Регистрация индивидуального предпринимателя (ИП)',
            'en': 'Registering as a sole proprietor'},
  'body': {'uz': "## Yakka tartibdagi tadbirkorlikni ro'yxatdan o'tkazish\n"
                 "**Kim uchun:** yolg'iz ishlaydigan jismoniy shaxs tadbirkorlar.\n"
                 '**Qadamlar:**\n'
                 '1. Faoliyat turini tanlang.\n'
                 '2. Shaxsni tasdiqlovchi hujjat va STIRni tayyorlang.\n'
                 '3. Arizani onlayn xizmat orqali yuboring.\n'
                 '4. Guvohnoma va soliq holatini oling.\n'
                 '\n'
                 "**Muddat:** odatda bir kun ichida. **To'lov:** ro'yxatdan o'tish arzon yoki "
                 "bepul bo'lishi mumkin.\n"
                 '\n'
                 "**Mas'ul organ:** Soliq qo'mitasi.",
           'ru': '## Регистрация ИП\n'
                 '**Для кого:** физические лица, работающие самостоятельно.\n'
                 '**Шаги:**\n'
                 '1. Выберите вид деятельности.\n'
                 '2. Подготовьте документ, удостоверяющий личность, и ИНН.\n'
                 '3. Отправьте заявление через онлайн-сервис портала.\n'
                 '4. Получите свидетельство и подтвердите налоговый статус.\n'
                 '\n'
                 '**Срок:** обычно в течение одного рабочего дня. **Оплата:** регистрация '
                 'недорогая или полностью бесплатная.\n'
                 '\n'
                 '**Ответственный орган:** Налоговый комитет.',
           'en': '## Registering as a sole proprietor\n'
                 '**Who it is for:** individuals working on their own account.\n'
                 '**Steps:**\n'
                 '1. Choose your type of activity.\n'
                 '2. Prepare an identity document and tax ID.\n'
                 '3. Submit the application through the online service.\n'
                 '4. Receive your certificate and tax status.\n'
                 '\n'
                 '**Timeframe:** usually within one day. **Cost:** registration is low-cost or '
                 'free.\n'
                 '\n'
                 '**Responsible body:** Tax Committee.'}},
 {'slug': 'business-license',
  'category': 'business',
  'tags': ['license', 'permit', 'regulated'],
  'order': 3,
  'source_url': 'https://my.gov.uz',
  'title': {'uz': 'Tartibga solinadigan faoliyat uchun litsenziya olish',
            'ru': 'Получение лицензии для регулируемой деятельности',
            'en': 'Obtaining a licence for a regulated activity'},
  'body': {'uz': '## Biznes litsenziyasini olish\n'
                 "**Kim uchun:** litsenziya talab etiladigan faoliyat bilan shug'ullanuvchi "
                 'tadbirkorlar.\n'
                 '**Qadamlar:**\n'
                 '1. Faoliyat turi litsenziyaga muhtojligini aniqlang.\n'
                 "2. Talab etilgan hujjatlarni yig'ing.\n"
                 '3. Arizani litsenziyalash organiga onlayn topshiring.\n'
                 "4. Ko'rib chiqishdan so'ng ruxsatnomani oling.\n"
                 '\n'
                 "**Muddat:** faoliyat turiga qarab farqlanadi. **To'lov:** davlat boji "
                 "to'lanadi.\n"
                 '\n'
                 "**Mas'ul organ:** Davlat xizmatlari agentligi.",
           'ru': '## Получение бизнес-лицензии\n'
                 '**Для кого:** предприниматели, ведущие лицензируемую деятельность.\n'
                 '**Шаги:**\n'
                 '1. Определите, требует ли ваш вид деятельности лицензии.\n'
                 '2. Соберите необходимые документы.\n'
                 '3. Подайте заявление в лицензирующий орган через портал онлайн.\n'
                 '4. Получите разрешение после рассмотрения вашего обращения.\n'
                 '\n'
                 '**Срок:** зависит от конкретного вида деятельности. **Оплата:** взимается '
                 'государственная пошлина.\n'
                 '\n'
                 '**Ответственный орган:** Агентство государственных услуг.',
           'en': '## Obtaining a business licence\n'
                 '**Who it is for:** entrepreneurs running a licensed activity.\n'
                 '**Steps:**\n'
                 '1. Determine whether your activity requires a licence.\n'
                 '2. Collect the required documents.\n'
                 '3. Submit the application to the licensing authority online.\n'
                 '4. Receive the permit after review.\n'
                 '\n'
                 '**Timeframe:** varies by type of activity. **Cost:** a state fee applies.\n'
                 '\n'
                 '**Responsible body:** Public Services Agency.'}},
 {'slug': 'close-company',
  'category': 'business',
  'tags': ['liquidation', 'closure', 'company'],
  'order': 4,
  'source_url': 'https://my.gov.uz',
  'title': {'uz': 'Kompaniyani tugatish (likvidatsiya qilish)',
            'ru': 'Ликвидация (закрытие) компании',
            'en': 'Liquidating (closing) a company'},
  'body': {'uz': '## Kompaniyani tugatish\n'
                 "**Kim uchun:** faoliyatni to'xtatmoqchi bo'lgan ta'sischilar.\n"
                 '**Qadamlar:**\n'
                 "1. Tugatish to'g'risida qaror qabul qiling.\n"
                 "2. Tugatish niyatini rasman e'lon qiling.\n"
                 '3. Qarzlar va soliqlarni yoping, hisobotlarni topshiring.\n'
                 '4. Reyestrdan chiqarish uchun ariza bering.\n'
                 '\n'
                 "**Muddat:** kreditorlar bilan hisob-kitobga bog'liq. **To'lov:** ayrim "
                 "bosqichlarda boj bo'lishi mumkin.\n"
                 '\n'
                 "**Mas'ul organ:** Davlat xizmatlari agentligi.",
           'ru': '## Ликвидация компании\n'
                 '**Для кого:** учредители, прекращающие деятельность.\n'
                 '**Шаги:**\n'
                 '1. Примите решение о ликвидации.\n'
                 '2. Официально объявите о намерении ликвидации.\n'
                 '3. Погасите долги и налоги, сдайте отчётность.\n'
                 '4. Подайте заявление об исключении из реестра.\n'
                 '\n'
                 '**Срок:** зависит от расчётов с кредиторами. **Оплата:** на отдельных этапах '
                 'возможна пошлина.\n'
                 '\n'
                 '**Ответственный орган:** Агентство государственных услуг.',
           'en': '## Liquidating a company\n'
                 '**Who it is for:** founders winding up their business.\n'
                 '**Steps:**\n'
                 '1. Adopt a decision to liquidate.\n'
                 '2. Officially announce the intention to liquidate.\n'
                 '3. Settle debts and taxes, and file final reports.\n'
                 '4. Apply for removal from the register.\n'
                 '\n'
                 '**Timeframe:** depends on settlements with creditors. **Cost:** a fee may apply '
                 'at certain stages.\n'
                 '\n'
                 '**Responsible body:** Public Services Agency.'}},
 {'slug': 'e-signature-business',
  'category': 'business',
  'tags': ['e-signature', 'eri', 'eds', 'e-services'],
  'order': 5,
  'source_url': 'https://soliq.uz',
  'title': {'uz': 'Biznes uchun elektron raqamli imzo (ERI) olish',
            'ru': 'Получение электронной цифровой подписи (ЭЦП) для бизнеса',
            'en': 'Getting an electronic digital signature (EDS) for business'},
  'body': {'uz': '## Biznes uchun ERI olish\n'
                 '**Nima uchun:** onlayn davlat va soliq xizmatlaridan foydalanish uchun.\n'
                 '**Qadamlar:**\n'
                 "1. Ro'yxatdan o'tgan kalit markazini tanlang.\n"
                 '2. Shaxsni va kompaniyani tasdiqlovchi hujjatlarni tayyorlang.\n'
                 '3. Onlayn ariza bering va shaxsingizni tasdiqlang.\n'
                 '4. Kalitni oling va tizimga ulang.\n'
                 '\n'
                 "**Amal muddati:** cheklangan, keyin yangilanadi. **To'lov:** xizmat haqi "
                 'olinishi mumkin.\n'
                 '\n'
                 "**Mas'ul organ:** Soliq qo'mitasi.",
           'ru': '## Получение ЭЦП для бизнеса\n'
                 '**Зачем:** для доступа к онлайн-услугам государства и налоговых органов.\n'
                 '**Шаги:**\n'
                 '1. Выберите зарегистрированный центр ключей.\n'
                 '2. Подготовьте документы, удостоверяющие личность и компанию.\n'
                 '3. Подайте заявку онлайн и подтвердите личность.\n'
                 '4. Получите ключ и подключите его к системе.\n'
                 '\n'
                 '**Срок действия:** ограниченный, затем продлевается. **Оплата:** может взиматься '
                 'плата за услугу.\n'
                 '\n'
                 '**Ответственный орган:** Налоговый комитет.',
           'en': '## Getting an EDS for business\n'
                 '**Why:** to access online government and tax services.\n'
                 '**Steps:**\n'
                 '1. Choose a registered key certification centre.\n'
                 '2. Prepare documents confirming your identity and company.\n'
                 '3. Apply online and verify your identity.\n'
                 '4. Receive the key and connect it to the system.\n'
                 '\n'
                 '**Validity:** limited, then renewable. **Cost:** a service fee may apply.\n'
                 '\n'
                 '**Responsible body:** Tax Committee.'}},
 {'slug': 'personal-tin',
  'category': 'taxes',
  'tags': ['stir', 'inn', 'registration', 'individual'],
  'order': 1,
  'source_url': 'https://soliq.uz',
  'title': {'uz': "Shaxsiy soliq to'lovchi raqamini (STIR) olish",
            'ru': 'Получение персонального ИНН (СТИР)',
            'en': 'Getting a personal taxpayer ID number (TIN)'},
  'body': {'uz': '## Shaxsiy STIR olish\n'
                 '\n'
                 "Soliq to'lovchining identifikatsiya raqami (STIR) soliq va bank amallari uchun "
                 'zarur.\n'
                 '\n'
                 '1. **Portal:** soliq.uz yoki my.gov.uz saytiga kiring.\n'
                 '2. **Autentifikatsiya:** shaxsiy kabinetga ID-karta yoki ERI orqali kiring.\n'
                 "3. **Ariza:** pasport ma'lumotlarini kiriting va so'rovni yuboring.\n"
                 "4. **Natija:** STIR odatda tez rasmiylashtiriladi va kabinetda ko'rinadi.\n"
                 '\n'
                 "**Mas'ul organ:** O'zbekiston Respublikasi Soliq qo'mitasi.",
           'ru': '## Получение персонального ИНН\n'
                 '\n'
                 'Идентификационный номер налогоплательщика (СТИР/ИНН) нужен для налоговых и '
                 'банковских операций.\n'
                 '\n'
                 '1. **Портал:** зайдите на soliq.uz или my.gov.uz.\n'
                 '2. **Аутентификация:** войдите в кабинет через ID-карту или ЭЦП.\n'
                 '3. **Заявка:** укажите паспортные данные и отправьте запрос.\n'
                 '4. **Результат:** ИНН обычно оформляется быстро и отображается в кабинете.\n'
                 '\n'
                 '**Ответственный орган:** Налоговый комитет Республики Узбекистан.',
           'en': '## Getting a personal TIN\n'
                 '\n'
                 'The taxpayer identification number (TIN/STIR) is needed for tax and banking '
                 'operations.\n'
                 '\n'
                 '1. **Portal:** open soliq.uz or my.gov.uz.\n'
                 '2. **Authentication:** sign in to your cabinet using an ID card or e-signature.\n'
                 '3. **Application:** enter your passport data and submit the request.\n'
                 '4. **Result:** the TIN is usually issued quickly and shown in your cabinet.\n'
                 '\n'
                 '**Responsible body:** Tax Committee of the Republic of Uzbekistan.'}},
 {'slug': 'tax-declaration',
  'category': 'taxes',
  'tags': ['declaration', 'income', 'annual', 'filing'],
  'order': 2,
  'source_url': 'https://soliq.uz',
  'title': {'uz': 'Yillik daromad soliqi deklaratsiyasini topshirish',
            'ru': 'Подача годовой декларации о доходах',
            'en': 'Filing an annual income tax declaration'},
  'body': {'uz': '## Yillik deklaratsiya topshirish\n'
                 '\n'
                 "Ayrim daromadlar bo'yicha jismoniy shaxslar yillik deklaratsiya taqdim etadi.\n"
                 '\n'
                 '1. **Kirish:** soliq.uz shaxsiy kabinetiga ID yoki ERI bilan kiring.\n'
                 '2. **Forma:** daromad deklaratsiyasi shaklini tanlang.\n'
                 "3. **Ma'lumot:** daromad manbalari va summalarni to'ldiring.\n"
                 "4. **Yuborish:** deklaratsiyani imzolang va onlayn jo'nating.\n"
                 '\n'
                 "Muddatlar o'zgarishi mumkin — soliq organidan tasdiqlang.\n"
                 '\n'
                 "**Mas'ul organ:** O'zbekiston Respublikasi Soliq qo'mitasi.",
           'ru': '## Подача годовой декларации\n'
                 '\n'
                 'По отдельным доходам физические лица подают годовую декларацию.\n'
                 '\n'
                 '1. **Вход:** зайдите в кабинет soliq.uz через ID или ЭЦП.\n'
                 '2. **Форма:** выберите форму декларации о доходах.\n'
                 '3. **Данные:** заполните источники и суммы доходов.\n'
                 '4. **Отправка:** подпишите декларацию и отправьте онлайн.\n'
                 '\n'
                 'Сроки могут меняться — уточните в налоговом органе.\n'
                 '\n'
                 '**Ответственный орган:** Налоговый комитет Республики Узбекистан.',
           'en': '## Filing an annual declaration\n'
                 '\n'
                 'For certain incomes, individuals submit an annual declaration.\n'
                 '\n'
                 '1. **Sign in:** access your soliq.uz cabinet via ID or e-signature.\n'
                 '2. **Form:** choose the income declaration form.\n'
                 '3. **Data:** fill in income sources and amounts.\n'
                 '4. **Submit:** sign the declaration and send it online.\n'
                 '\n'
                 'Deadlines may vary — confirm with the tax authority.\n'
                 '\n'
                 '**Responsible body:** Tax Committee of the Republic of Uzbekistan.'}},
 {'slug': 'vat-registration',
  'category': 'taxes',
  'tags': ['vat', 'qqs', 'nds', 'business'],
  'order': 3,
  'source_url': 'https://soliq.uz',
  'title': {'uz': "Qo'shilgan qiymat solig'i (QQS) uchun ro'yxatdan o'tish",
            'ru': 'Регистрация плательщиком НДС',
            'en': 'Registering for VAT'},
  'body': {'uz': "## QQS uchun ro'yxatdan o'tish\n"
                 '\n'
                 "Belgilangan aylanmaga yetgan tadbirkorlar QQS to'lovchisi sifatida ro'yxatga "
                 'olinadi.\n'
                 '\n'
                 '1. **Kirish:** soliq.uz kabinetiga ERI bilan kiring.\n'
                 "2. **Ariza:** QQS ro'yxatidan o'tish arizasini tanlang.\n"
                 "3. **Ma'lumot:** faoliyat va aylanma ma'lumotlarini kiriting.\n"
                 "4. **Tasdiq:** ariza ko'rib chiqiladi va guvohnoma beriladi.\n"
                 '\n'
                 "Stavka va ostonalar o'zgarishi mumkin — soliq organidan tasdiqlang.\n"
                 '\n'
                 "**Mas'ul organ:** O'zbekiston Respublikasi Soliq qo'mitasi.",
           'ru': '## Регистрация плательщиком НДС\n'
                 '\n'
                 'Предприниматели, достигшие установленного оборота, регистрируются плательщиками '
                 'НДС.\n'
                 '\n'
                 '1. **Вход:** зайдите в кабинет soliq.uz с ЭЦП.\n'
                 '2. **Заявка:** выберите заявление о регистрации по НДС.\n'
                 '3. **Данные:** укажите сведения о деятельности и обороте.\n'
                 '4. **Подтверждение:** заявление рассматривается и выдаётся свидетельство.\n'
                 '\n'
                 'Ставка и пороги могут меняться — уточните в налоговом органе.\n'
                 '\n'
                 '**Ответственный орган:** Налоговый комитет Республики Узбекистан.',
           'en': '## Registering for VAT\n'
                 '\n'
                 'Businesses reaching the set turnover register as VAT payers.\n'
                 '\n'
                 '1. **Sign in:** access your soliq.uz cabinet with an e-signature.\n'
                 '2. **Application:** select the VAT registration application.\n'
                 '3. **Data:** enter details about your activity and turnover.\n'
                 '4. **Confirmation:** the application is reviewed and a certificate is issued.\n'
                 '\n'
                 'Rates and thresholds may vary — confirm with the tax authority.\n'
                 '\n'
                 '**Responsible body:** Tax Committee of the Republic of Uzbekistan.'}},
 {'slug': 'itpark-tax-benefits',
  'category': 'taxes',
  'tags': ['it-park', 'benefits', 'residency', 'tech'],
  'order': 4,
  'source_url': 'https://my.gov.uz',
  'title': {'uz': 'IT Park rezidentligi soliq imtiyozlari',
            'ru': 'Налоговые льготы для резидентов IT Park',
            'en': 'IT Park residency tax benefits'},
  'body': {'uz': '## IT Park soliq imtiyozlari\n'
                 '\n'
                 'IT Park rezidentligi IT kompaniyalariga soliq imtiyozlari beradi.\n'
                 '\n'
                 '1. **Ariza:** IT Park rezidentligi uchun onlayn ariza topshiring.\n'
                 '2. **Hujjatlar:** faoliyat turi va biznes-rejani taqdim eting.\n'
                 "3. **Ko'rib chiqish:** ariza baholanadi va status beriladi.\n"
                 '4. **Imtiyoz:** rezidentlar imtiyozli soliq rejimidan foydalanadi.\n'
                 '\n'
                 "Sharoit va stavkalar o'zgarishi mumkin — IT Parkdan tasdiqlang.\n"
                 '\n'
                 "**Mas'ul organ:** IT Park O'zbekiston.",
           'ru': '## Налоговые льготы IT Park\n'
                 '\n'
                 'Резидентство IT Park даёт IT-компаниям налоговые льготы.\n'
                 '\n'
                 '1. **Заявка:** подайте онлайн-заявку на резидентство IT Park.\n'
                 '2. **Документы:** предоставьте вид деятельности и бизнес-план.\n'
                 '3. **Рассмотрение:** заявка оценивается и присваивается статус.\n'
                 '4. **Льгота:** резиденты пользуются льготным налоговым режимом.\n'
                 '\n'
                 'Условия и ставки могут меняться — уточните в IT Park.\n'
                 '\n'
                 '**Ответственный орган:** IT Park Узбекистан.',
           'en': '## IT Park tax benefits\n'
                 '\n'
                 'IT Park residency gives IT companies tax benefits.\n'
                 '\n'
                 '1. **Application:** submit an online application for IT Park residency.\n'
                 '2. **Documents:** provide your activity type and business plan.\n'
                 '3. **Review:** the application is assessed and status is granted.\n'
                 '4. **Benefit:** residents enjoy a preferential tax regime.\n'
                 '\n'
                 'Conditions and rates may vary — confirm with IT Park.\n'
                 '\n'
                 '**Responsible body:** IT Park Uzbekistan.'}},
 {'slug': 'pay-taxes-online',
  'category': 'taxes',
  'tags': ['payment', 'online', 'soliq', 'e-gov'],
  'order': 5,
  'source_url': 'https://soliq.uz',
  'title': {'uz': "Soliqlarni onlayn to'lash",
            'ru': 'Оплата налогов онлайн',
            'en': 'Paying taxes online'},
  'body': {'uz': "## Soliqlarni onlayn to'lash\n"
                 '\n'
                 "Soliqlarni soliq.uz yoki my.gov.uz orqali onlayn to'lash mumkin.\n"
                 '\n'
                 '1. **Kirish:** shaxsiy kabinetga ID yoki ERI bilan kiring.\n'
                 "2. **Hisob:** to'lov turini va summani tanlang.\n"
                 "3. **To'lov:** bank kartasi orqali to'lovni amalga oshiring.\n"
                 "4. **Kvitansiya:** to'lov cheki kabinetda saqlanadi.\n"
                 '\n'
                 "Muddatlar o'zgarishi mumkin — soliq organidan tasdiqlang.\n"
                 '\n'
                 "**Mas'ul organ:** O'zbekiston Respublikasi Soliq qo'mitasi.",
           'ru': '## Оплата налогов онлайн\n'
                 '\n'
                 'Налоги можно оплатить онлайн через soliq.uz или my.gov.uz.\n'
                 '\n'
                 '1. **Вход:** зайдите в кабинет через ID или ЭЦП.\n'
                 '2. **Счёт:** выберите вид платежа и сумму.\n'
                 '3. **Оплата:** проведите оплату банковской картой.\n'
                 '4. **Квитанция:** чек об оплате сохраняется в кабинете.\n'
                 '\n'
                 'Сроки могут меняться — уточните в налоговом органе.\n'
                 '\n'
                 '**Ответственный орган:** Налоговый комитет Республики Узбекистан.',
           'en': '## Paying taxes online\n'
                 '\n'
                 'Taxes can be paid online through soliq.uz or my.gov.uz.\n'
                 '\n'
                 '1. **Sign in:** access your cabinet via ID or e-signature.\n'
                 '2. **Invoice:** choose the payment type and amount.\n'
                 '3. **Payment:** complete the payment with a bank card.\n'
                 '4. **Receipt:** the payment receipt is stored in your cabinet.\n'
                 '\n'
                 'Deadlines may vary — confirm with the tax authority.\n'
                 '\n'
                 '**Responsible body:** Tax Committee of the Republic of Uzbekistan.'}},
 {'slug': 'emergency-medical',
  'category': 'healthcare',
  'tags': ['emergency', 'ambulance', 'short'],
  'order': 1,
  'title': {'uz': 'Shoshilinch tibbiy yordam',
            'ru': 'Экстренная медицинская помощь',
            'en': 'Emergency Medical Help'},
  'body': {'uz': '## Shoshilinch tibbiy yordam\n'
                 '\n'
                 "**Qachon qo'ng'iroq qilish:** hayot uchun xavfli holatlar, jarohatlar, to'satdan "
                 "og'ir kasallik.\n"
                 '\n'
                 '**Yordam olish tartibi:**\n'
                 "1. Tez yordam uchun **103** yoki yagona **112** raqamiga qo'ng'iroq qiling.\n"
                 '2. Aniq manzilingizni ayting va bemor holatini tasvirlab bering.\n'
                 "3. Aloqada qoling va yordam yetib kelguncha dispetcher ko'rsatmalariga amal "
                 'qiling.\n'
                 '\n'
                 "Shoshilinch yordam har kimga, jumladan chet elliklarga ham ko'rsatiladi. Og'ir "
                 "jarohatlangan odamni zarurat bo'lmasa qimirlatmang.\n"
                 '\n'
                 "**Mas'ul organ:** Sog'liqni saqlash vazirligi.",
           'ru': '## Экстренная медицинская помощь\n'
                 '\n'
                 '**Когда звонить:** угрожающие жизни состояния, травмы, внезапная тяжёлая '
                 'болезнь.\n'
                 '\n'
                 '**Как получить помощь:**\n'
                 '1. Звоните **103** для вызова скорой или на единый номер **112**.\n'
                 '2. Назовите точный адрес и опишите состояние больного.\n'
                 '3. Оставайтесь на линии и следуйте указаниям диспетчера до приезда помощи.\n'
                 '\n'
                 'Экстренная помощь оказывается всем, включая иностранцев. Не перемещайте тяжело '
                 'пострадавших без крайней необходимости.\n'
                 '\n'
                 '**Ответственный орган:** Министерство здравоохранения.',
           'en': '## Emergency Medical Help\n'
                 '\n'
                 '**When to call:** life-threatening conditions, injuries, sudden severe illness.\n'
                 '\n'
                 '**How to get help:**\n'
                 '1. Call **103** for an ambulance, or the unified **112** line.\n'
                 "2. State your exact location and describe the patient's condition.\n"
                 "3. Stay on the line and follow the dispatcher's instructions until help "
                 'arrives.\n'
                 '\n'
                 'Emergency care is available to everyone, including foreigners. Do not move '
                 'seriously injured people unless there is immediate danger.\n'
                 '\n'
                 '**Responsible body:** Ministry of Health.'}},
 {'slug': 'health-insurance',
  'category': 'healthcare',
  'tags': ['insurance', 'foreigners', 'short'],
  'order': 2,
  'source_url': 'https://my.gov.uz',
  'title': {'uz': "Tibbiy sug'urtani rasmiylashtirish",
            'ru': 'Оформление медицинского страхования',
            'en': 'Getting Health Insurance'},
  'body': {'uz': "## Tibbiy sug'urtani rasmiylashtirish\n"
                 '\n'
                 "O'zbekistonda davlat tibbiy sug'urtasi rivojlanmoqda; xususiy polislar ham "
                 'mavjud.\n'
                 '\n'
                 '**Asosiy bosqichlar:**\n'
                 "1. Maqomingizga mos davlat yoki xususiy sug'urta turini tanlang.\n"
                 '2. Pasportingizni, chet elliklar esa yashash yoki viza hujjatini tayyorlang.\n'
                 "3. Sug'urtachi yoki davlat xizmatlari markazi orqali ariza bering va badalni "
                 "to'lang.\n"
                 '4. Polisni oling va uni hamkor klinikalarda ishlating.\n'
                 '\n'
                 "Chet elliklar davolanish va yashash uchun ixtiyoriy tibbiy sug'urta "
                 'rasmiylashtirishi mumkin.\n'
                 '\n'
                 "**Mas'ul organ:** Sog'liqni saqlash vazirligi.",
           'ru': '## Оформление медицинского страхования\n'
                 '\n'
                 'Узбекистан развивает государственное медицинское страхование; доступны и частные '
                 'полисы.\n'
                 '\n'
                 '**Основные шаги:**\n'
                 '1. Выберите государственный или частный вариант, подходящий вашему статусу.\n'
                 '2. Подготовьте паспорт, а иностранцам — документ о проживании или визу.\n'
                 '3. Подайте заявку через страховщика или центр госуслуг и оплатите взнос.\n'
                 '4. Получите полис и пользуйтесь им в участвующих клиниках.\n'
                 '\n'
                 'Иностранцы могут оформить добровольное медицинское страхование для лечения и '
                 'проживания.\n'
                 '\n'
                 '**Ответственный орган:** Министерство здравоохранения.',
           'en': '## Getting Health Insurance\n'
                 '\n'
                 'Uzbekistan is expanding state health insurance; private policies are also '
                 'available.\n'
                 '\n'
                 '**Main steps:**\n'
                 '1. Choose a state or private insurance option that fits your status.\n'
                 '2. Prepare your passport and, for foreigners, a residence or visa document.\n'
                 '3. Apply through an insurer or a government service centre and pay the premium.\n'
                 '4. Receive your policy and use it at participating clinics.\n'
                 '\n'
                 'Foreigners can obtain voluntary medical insurance for treatment and residence '
                 'purposes.\n'
                 '\n'
                 '**Responsible body:** Ministry of Health.'}},
 {'slug': 'vaccination-certificate',
  'category': 'healthcare',
  'tags': ['vaccination', 'certificate', 'children'],
  'order': 3,
  'source_url': 'https://my.gov.uz',
  'title': {'uz': 'Emlash sertifikati',
            'ru': 'Сертификат о вакцинации',
            'en': 'Vaccination Certificate'},
  'body': {'uz': '## Emlash sertifikati\n'
                 '\n'
                 'Emlash sertifikati siz olgan emlashlarni tasdiqlaydi.\n'
                 '\n'
                 '**Qanday olinadi:**\n'
                 '1. Davlat klinikasi, oilaviy poliklinika yoki vakolatli markazda emlaning.\n'
                 "2. Shaxsingizni tasdiqlovchi hujjatni, bolalar uchun tug'ilganlik guvohnomasini "
                 'taqdim eting.\n'
                 "3. Har bir dozani emlash kartangizga qayd etishni so'rang.\n"
                 "4. Sertifikatni qog'oz yoki elektron shaklda oling.\n"
                 '\n'
                 "Sertifikat o'qish, sayohat va ishga joylashishda kerak bo'ladi. Har doza olgach "
                 'kartangizni yangilab boring.\n'
                 '\n'
                 "**Mas'ul organ:** Sog'liqni saqlash vazirligi.",
           'ru': '## Сертификат о вакцинации\n'
                 '\n'
                 'Сертификат о вакцинации подтверждает полученные вами прививки.\n'
                 '\n'
                 '**Как получить:**\n'
                 '1. Пройдите вакцинацию в государственной клинике, семейной поликлинике или '
                 'уполномоченном центре.\n'
                 '2. Предъявите удостоверение личности, а для детей — свидетельство о рождении.\n'
                 '3. Попросите внести каждую дозу в вашу карту прививок.\n'
                 '4. Запросите сертификат в бумажном или электронном виде.\n'
                 '\n'
                 'Сертификат нужен для учёбы, поездок и трудоустройства. Обновляйте карту после '
                 'каждой дозы.\n'
                 '\n'
                 '**Ответственный орган:** Министерство здравоохранения.',
           'en': '## Vaccination Certificate\n'
                 '\n'
                 'A vaccination certificate confirms the immunizations you have received.\n'
                 '\n'
                 '**How to obtain it:**\n'
                 '1. Get vaccinated at a state clinic, family polyclinic, or authorised centre.\n'
                 '2. Provide your ID and, for children, the birth certificate.\n'
                 '3. Ask the clinic to record each dose in your vaccination record.\n'
                 '4. Request the certificate on paper or in electronic form.\n'
                 '\n'
                 'Certificates are useful for school, travel, and employment. Keep your record '
                 'updated after every dose.\n'
                 '\n'
                 '**Responsible body:** Ministry of Health.'}},
 {'slug': 'medical-certificate-driving',
  'category': 'healthcare',
  'tags': ['driving', 'certificate', 'medical'],
  'order': 4,
  'source_url': 'https://my.gov.uz',
  'title': {'uz': "Haydovchilik guvohnomasi uchun tibbiy ma'lumotnoma",
            'ru': 'Медицинская справка для водительских прав',
            'en': 'Medical Certificate for a Driving Licence'},
  'body': {'uz': "## Haydovchilik guvohnomasi uchun tibbiy ma'lumotnoma\n"
                 '\n'
                 "Tibbiy ma'lumotnoma guvohnoma olishdan oldin haydashga yaroqliligingizni "
                 'tasdiqlaydi.\n'
                 '\n'
                 '**Qanday olinadi:**\n'
                 "1. Haydovchi ma'lumotnomasini beruvchi vakolatli tibbiy muassasaga murojaat "
                 'qiling.\n'
                 "2. Pasportingizni va zarur bo'lsa rasm olib boring.\n"
                 "3. Ko'rsatilgan mutaxassislar, jumladan ko'rish va umumiy salomatlik ko'rigidan "
                 "o'ting.\n"
                 "4. Ma'lumotnomani oling va uni guvohnoma arizasi bilan topshiring.\n"
                 '\n'
                 "Ma'lumotnoma amal qilish muddati cheklangan, shuning uchun guvohnoma sanasiga "
                 'yaqin rasmiylashtiring.\n'
                 '\n'
                 "**Mas'ul organ:** Sog'liqni saqlash vazirligi.",
           'ru': '## Медицинская справка для водительских прав\n'
                 '\n'
                 'Медицинская справка подтверждает вашу пригодность к вождению перед получением '
                 'прав.\n'
                 '\n'
                 '**Как получить:**\n'
                 '1. Обратитесь в уполномоченное медучреждение, выдающее водительские справки.\n'
                 '2. Возьмите паспорт и, при необходимости, фотографию.\n'
                 '3. Пройдите осмотр указанных специалистов, включая зрение и общее здоровье.\n'
                 '4. Получите справку и подайте её вместе с заявлением на права.\n'
                 '\n'
                 'Справка имеет ограниченный срок действия, поэтому оформляйте её ближе к дате '
                 'получения прав.\n'
                 '\n'
                 '**Ответственный орган:** Министерство здравоохранения.',
           'en': '## Medical Certificate for a Driving Licence\n'
                 '\n'
                 'A medical certificate confirms you are fit to drive before applying for a '
                 'licence.\n'
                 '\n'
                 '**How to get it:**\n'
                 '1. Visit an authorised medical facility that issues driver certificates.\n'
                 '2. Bring your passport and, if required, a photo.\n'
                 '3. Pass examinations by the listed specialists, including vision and general '
                 'health.\n'
                 '4. Receive the certificate and submit it with your licence application.\n'
                 '\n'
                 'The certificate has a limited validity period, so apply close to your licence '
                 'date.\n'
                 '\n'
                 '**Responsible body:** Ministry of Health.'}},
 {'slug': 'newborn-health',
  'category': 'healthcare',
  'tags': ['newborn', 'children', 'checkups'],
  'order': 5,
  'source_url': 'https://my.gov.uz',
  'title': {'uz': "Chaqaloqni tibbiy ro'yxatga olish",
            'ru': 'Медицинская регистрация новорождённого',
            'en': 'Newborn Medical Registration'},
  'body': {'uz': "## Chaqaloqni tibbiy ro'yxatga olish\n"
                 '\n'
                 "Tug'ilgandan so'ng chaqaloqni tibbiy yordam va birinchi ko'riklar uchun "
                 "ro'yxatdan o'tkazing.\n"
                 '\n'
                 '**Asosiy bosqichlar:**\n'
                 "1. Tug'ruqxonadan tug'ilganlik haqidagi tibbiy ma'lumotnomani oling.\n"
                 '2. Chaqaloqni yashash joyidagi oilaviy poliklinikaga biriktiring.\n'
                 "3. Birinchi patronaj va rejalashtirilgan pediatr ko'riklaridan o'ting.\n"
                 '4. Emlash jadvaliga amal qiling va bola salomatlik kartasini yuriting.\n'
                 '\n'
                 "Erta ko'riklar muammolarni aniqlash va sog'lom rivojlanishni ta'minlashga yordam "
                 "beradi. Shoshilinch holatda **103** yoki **112** ga qo'ng'iroq qiling.\n"
                 '\n'
                 "**Mas'ul organ:** Sog'liqni saqlash vazirligi.",
           'ru': '## Медицинская регистрация новорождённого\n'
                 '\n'
                 'После рождения зарегистрируйте новорождённого для медпомощи и первых осмотров.\n'
                 '\n'
                 '**Основные шаги:**\n'
                 '1. Получите медицинскую справку о рождении в роддоме.\n'
                 '2. Прикрепите новорождённого к местной семейной поликлинике.\n'
                 '3. Пройдите первый патронаж и плановые осмотры у педиатра.\n'
                 '4. Соблюдайте график прививок и ведите карту здоровья ребёнка.\n'
                 '\n'
                 'Ранние осмотры помогают выявить проблемы и обеспечить здоровое развитие. При '
                 'экстренных случаях звоните **103** или **112**.\n'
                 '\n'
                 '**Ответственный орган:** Министерство здравоохранения.',
           'en': '## Newborn Medical Registration\n'
                 '\n'
                 'After birth, register your newborn for medical care and first check-ups.\n'
                 '\n'
                 '**Main steps:**\n'
                 '1. Obtain the medical birth record from the maternity facility.\n'
                 '2. Attach the newborn to your local family polyclinic.\n'
                 '3. Attend the first home visit and scheduled check-ups by a paediatrician.\n'
                 "4. Follow the immunization schedule and keep the child's health record.\n"
                 '\n'
                 'Early check-ups help detect problems and ensure healthy development. For '
                 'emergencies, call **103** or **112**.\n'
                 '\n'
                 '**Responsible body:** Ministry of Health.'}},
 {'slug': 'tourist-visa',
  'category': 'visa-migration',
  'tags': ['visa', 'tourist', 'e-visa'],
  'order': 1,
  'source_url': 'https://e-visa.gov.uz',
  'title': {'uz': 'Turistik viza va E-VIZA',
            'ru': 'Туристическая виза и E-VISA',
            'en': 'Tourist visa and E-VISA'},
  'body': {'uz': '## Turistik viza va E-VIZA\n'
                 '\n'
                 "Ko'plab davlatlar fuqarolari uchun **vizasiz rejim** amal qiladi. Boshqalar esa "
                 'onlayn **E-VIZA** rasmiylashtiradi.\n'
                 '\n'
                 '**Asosiy qadamlar:**\n'
                 '\n'
                 "1. Portalda ariza to'ldiring va pasport ma'lumotlarini kiriting.\n"
                 "2. Suratni yuklang va **davlat bojini** to'lang.\n"
                 '3. Elektron vizani pochta orqali oling.\n'
                 '\n'
                 "**Muhim:** pasport amal qilish muddati yetarli bo'lsin.\n"
                 '\n'
                 "**Mas'ul organ:** O'zbekiston Respublikasi Tashqi ishlar vazirligi.",
           'ru': '## Туристическая виза и E-VISA\n'
                 '\n'
                 'Для граждан многих стран действует **безвизовый режим**. Остальные оформляют '
                 'визу онлайн через сервис **E-VISA**.\n'
                 '\n'
                 '**Основные шаги:**\n'
                 '\n'
                 '1. Заполните заявку на портале и укажите данные паспорта.\n'
                 '2. Загрузите фотографию и оплатите **государственную пошлину**.\n'
                 '3. Получите электронную визу по электронной почте.\n'
                 '\n'
                 '**Важно:** срок действия паспорта должен быть достаточным.\n'
                 '\n'
                 '**Ответственный орган:** Министерство иностранных дел Республики Узбекистан.',
           'en': '## Tourist visa and E-VISA\n'
                 '\n'
                 'A **visa-free regime** applies to citizens of many countries. Others obtain an '
                 'entry visa online through the **E-VISA** service.\n'
                 '\n'
                 '**Main steps:**\n'
                 '\n'
                 '1. Complete the application on the portal and enter passport details.\n'
                 '2. Upload a photo and pay the **state fee**.\n'
                 '3. Receive the electronic visa by email.\n'
                 '\n'
                 '**Note:** your passport must remain valid long enough.\n'
                 '\n'
                 '**Responsible body:** Ministry of Foreign Affairs of the Republic of '
                 'Uzbekistan.'}},
 {'slug': 'evisa-extension',
  'category': 'visa-migration',
  'tags': ['visa', 'extension', 'e-visa'],
  'order': 2,
  'source_url': 'https://e-visa.gov.uz',
  'title': {'uz': 'E-VIZA yoki vizani uzaytirish',
            'ru': 'Продление E-VISA или визы',
            'en': 'Extending an e-visa or visa'},
  'body': {'uz': '## E-VIZA yoki vizani uzaytirish\n'
                 '\n'
                 "Vaqtincha bo'lish muddatini uzaytirish uchun ariza **muddat tugashidan oldin** "
                 'topshiriladi.\n'
                 '\n'
                 '**Tartib:**\n'
                 '\n'
                 '1. Onlayn ariza va joriy vizani taqdim eting.\n'
                 '2. Uzaytirish sababini asoslang.\n'
                 "3. **Davlat bojini** to'lang va qarorni kuting.\n"
                 '\n'
                 "**Eslatma:** muddatni buzish ma'muriy javobgarlikka olib keladi.\n"
                 '\n'
                 "**Mas'ul organ:** O'zbekiston Respublikasi Ichki ishlar vazirligi (IIV) "
                 'migratsiya organlari.',
           'ru': '## Продление E-VISA или визы\n'
                 '\n'
                 'Чтобы продлить срок временного пребывания, заявление подаётся **до истечения** '
                 'действующей визы.\n'
                 '\n'
                 '**Порядок:**\n'
                 '\n'
                 '1. Подайте онлайн-заявление и предъявите текущую визу.\n'
                 '2. Обоснуйте причину продления.\n'
                 '3. Оплатите **государственную пошлину** и дождитесь решения.\n'
                 '\n'
                 '**Примечание:** нарушение срока влечёт административную ответственность.\n'
                 '\n'
                 '**Ответственный орган:** органы миграции Министерства внутренних дел (МВД) '
                 'Республики Узбекистан.',
           'en': '## Extending an e-visa or visa\n'
                 '\n'
                 'To prolong the period of temporary stay, the application is filed **before** the '
                 'current visa expires.\n'
                 '\n'
                 '**Procedure:**\n'
                 '\n'
                 '1. Submit an online application and present the current visa.\n'
                 '2. State the reason for the extension.\n'
                 '3. Pay the **state fee** and await the decision.\n'
                 '\n'
                 '**Note:** overstaying leads to administrative liability.\n'
                 '\n'
                 '**Responsible body:** migration authorities of the Ministry of Internal Affairs '
                 '(IIV) of the Republic of Uzbekistan.'}},
 {'slug': 'work-permit',
  'category': 'visa-migration',
  'tags': ['work', 'employment', 'foreigners'],
  'order': 3,
  'title': {'uz': 'Chet el fuqarolari uchun ishlash ruxsatnomasi',
            'ru': 'Разрешение на работу для иностранцев',
            'en': 'Work permit for foreign nationals'},
  'body': {'uz': '## Chet el fuqarolari uchun ishlash ruxsatnomasi\n'
                 '\n'
                 'Chet el fuqarosini ishga olish uchun ish beruvchi **ruxsatnoma** '
                 'rasmiylashtiradi, xodim esa **mehnat kartasi** oladi.\n'
                 '\n'
                 '**Bosqichlar:**\n'
                 '\n'
                 '1. Ish beruvchi kvota doirasida ariza topshiradi.\n'
                 '2. Mehnat shartnomasi va hujjatlarni ilova qiladi.\n'
                 "3. **Davlat bojini** to'lab, ruxsatnomani oladi.\n"
                 '\n'
                 '**Eslatma:** ruxsatnoma muddati chegaralangan va uzaytiriladi.\n'
                 '\n'
                 "**Mas'ul organ:** O'zbekiston Respublikasi Ichki ishlar vazirligi (IIV) "
                 'migratsiya organlari.',
           'ru': '## Разрешение на работу для иностранцев\n'
                 '\n'
                 'Для найма иностранца работодатель оформляет **разрешение**, а сотрудник получает '
                 '**трудовую карту**.\n'
                 '\n'
                 '**Этапы:**\n'
                 '\n'
                 '1. Работодатель подаёт заявку в пределах квоты.\n'
                 '2. Прилагает трудовой договор и документы.\n'
                 '3. Оплачивает **государственную пошлину** и получает разрешение.\n'
                 '\n'
                 '**Примечание:** срок разрешения ограничен и может продлеваться.\n'
                 '\n'
                 '**Ответственный орган:** органы миграции Министерства внутренних дел (МВД) '
                 'Республики Узбекистан.',
           'en': '## Work permit for foreign nationals\n'
                 '\n'
                 'To hire a foreigner, the employer arranges a **permit**, while the employee '
                 'receives a **labour card**.\n'
                 '\n'
                 '**Stages:**\n'
                 '\n'
                 '1. The employer applies within the established quota.\n'
                 '2. Attaches the employment contract and documents.\n'
                 '3. Pays the **state fee** and receives the permit.\n'
                 '\n'
                 '**Note:** the permit has a limited term and may be extended.\n'
                 '\n'
                 '**Responsible body:** migration authorities of the Ministry of Internal Affairs '
                 '(IIV) of the Republic of Uzbekistan.'}},
 {'slug': 'residence-permit',
  'category': 'visa-migration',
  'tags': ['residence', 'foreigners', 'registration'],
  'order': 4,
  'title': {'uz': 'Chet elliklar uchun yashash guvohnomasi',
            'ru': 'Вид на жительство для иностранцев',
            'en': 'Residence permit for foreigners'},
  'body': {'uz': '## Chet elliklar uchun yashash guvohnomasi\n'
                 '\n'
                 'Chet el fuqarolari **vaqtincha** yoki **doimiy** yashash guvohnomasini '
                 'rasmiylashtirishi mumkin.\n'
                 '\n'
                 '**Tartib:**\n'
                 '\n'
                 '1. Migratsiya organiga ariza va pasportni taqdim eting.\n'
                 '2. Yashash manzili va asoslarni tasdiqlang.\n'
                 "3. **Davlat bojini** to'lab, guvohnomani oling.\n"
                 '\n'
                 "**Eslatma:** yashash joyi bo'yicha ro'yxatdan o'tish shart.\n"
                 '\n'
                 "**Mas'ul organ:** O'zbekiston Respublikasi Ichki ishlar vazirligi (IIV) "
                 'migratsiya organlari.',
           'ru': '## Вид на жительство для иностранцев\n'
                 '\n'
                 'Иностранные граждане могут оформить **временный** или **постоянный** вид на '
                 'жительство.\n'
                 '\n'
                 '**Порядок:**\n'
                 '\n'
                 '1. Подайте заявление и паспорт в орган миграции.\n'
                 '2. Подтвердите адрес проживания и основания.\n'
                 '3. Оплатите **государственную пошлину** и получите документ.\n'
                 '\n'
                 '**Примечание:** обязательна регистрация по месту жительства.\n'
                 '\n'
                 '**Ответственный орган:** органы миграции Министерства внутренних дел (МВД) '
                 'Республики Узбекистан.',
           'en': '## Residence permit for foreigners\n'
                 '\n'
                 'Foreign citizens may obtain a **temporary** or **permanent** residence permit.\n'
                 '\n'
                 '**Procedure:**\n'
                 '\n'
                 '1. Submit an application and passport to the migration authority.\n'
                 '2. Confirm your address of residence and the grounds.\n'
                 '3. Pay the **state fee** and receive the document.\n'
                 '\n'
                 '**Note:** registration at the place of residence is mandatory.\n'
                 '\n'
                 '**Responsible body:** migration authorities of the Ministry of Internal Affairs '
                 '(IIV) of the Republic of Uzbekistan.'}},
 {'slug': 'citizenship',
  'category': 'visa-migration',
  'tags': ['citizenship', 'naturalization'],
  'order': 5,
  'title': {'uz': "O'zbekiston fuqaroligiga qabul qilish",
            'ru': 'Приём в гражданство Узбекистана',
            'en': 'Applying for Uzbek citizenship'},
  'body': {'uz': "## O'zbekiston fuqaroligiga qabul qilish\n"
                 '\n'
                 "Chet el fuqarolari va fuqaroligi bo'lmagan shaxslar belgilangan shartlar asosida "
                 '**fuqarolikka** qabul qilinishi mumkin.\n'
                 '\n'
                 '**Asosiy qadamlar:**\n'
                 '\n'
                 '1. Doimiy yashash va davlat tilini bilishni tasdiqlang.\n'
                 "2. Ariza va hujjatlar to'plamini topshiring.\n"
                 "3. Qarorni kuting; **davlat bojini** to'lang.\n"
                 '\n'
                 '**Eslatma:** qaror yuqori organ tomonidan tasdiqlanadi.\n'
                 '\n'
                 "**Mas'ul organ:** O'zbekiston Respublikasi Ichki ishlar vazirligi (IIV).",
           'ru': '## Приём в гражданство Узбекистана\n'
                 '\n'
                 'Иностранные граждане и лица без гражданства могут быть приняты в **гражданство** '
                 'при соблюдении установленных условий.\n'
                 '\n'
                 '**Основные шаги:**\n'
                 '\n'
                 '1. Подтвердите постоянное проживание и знание государственного языка.\n'
                 '2. Подайте заявление и пакет документов.\n'
                 '3. Дождитесь решения; оплатите **государственную пошлину**.\n'
                 '\n'
                 '**Примечание:** решение утверждается уполномоченным органом.\n'
                 '\n'
                 '**Ответственный орган:** Министерство внутренних дел (МВД) Республики '
                 'Узбекистан.',
           'en': '## Applying for Uzbek citizenship\n'
                 '\n'
                 'Foreign citizens and stateless persons may be admitted to **citizenship** if the '
                 'established conditions are met.\n'
                 '\n'
                 '**Main steps:**\n'
                 '\n'
                 '1. Confirm permanent residence and knowledge of the state language.\n'
                 '2. Submit the application and the set of documents.\n'
                 '3. Await the decision; pay the **state fee**.\n'
                 '\n'
                 '**Note:** the decision is approved by the competent authority.\n'
                 '\n'
                 '**Responsible body:** Ministry of Internal Affairs (IIV) of the Republic of '
                 'Uzbekistan.'}},
 {'slug': 'drivers-license',
  'category': 'transport',
  'tags': ['license', 'driving', 'renewal'],
  'order': 1,
  'source_url': 'https://my.gov.uz',
  'title': {'uz': 'Haydovchilik guvohnomasini olish yoki yangilash',
            'ru': 'Получение или замена водительского удостоверения',
            'en': 'Obtaining or renewing a driving licence'},
  'body': {'uz': '## Haydovchilik guvohnomasi\n'
                 '\n'
                 'Yangi guvohnoma olish yoki muddati tugaganini yangilash uchun quyidagi '
                 'bosqichlarni bajaring.\n'
                 '\n'
                 '1. **Ariza:** yagona portal orqali onlayn topshiring.\n'
                 '2. **Hujjatlar:** pasport va tibbiy xulosani biriktiring.\n'
                 "3. **To'lov:** davlat bojini onlayn to'lang.\n"
                 "4. **Imtihon:** kerak bo'lsa nazariy va amaliy sinovdan o'ting.\n"
                 "5. **Olish:** tayyor guvohnomani belgilangan bo'limdan oling.\n"
                 '\n'
                 "**Mas'ul organ:** IIV Yo'l harakati xavfsizligi boshqarmasi (YHXX).",
           'ru': '## Водительское удостоверение\n'
                 '\n'
                 'Чтобы получить новое удостоверение или заменить просроченное, выполните '
                 'следующие шаги.\n'
                 '\n'
                 '1. **Заявление:** подайте онлайн через единый портал.\n'
                 '2. **Документы:** приложите паспорт и медицинское заключение.\n'
                 '3. **Оплата:** внесите госпошлину онлайн.\n'
                 '4. **Экзамен:** при необходимости сдайте теорию и вождение.\n'
                 '5. **Получение:** заберите готовое удостоверение в указанном отделении.\n'
                 '\n'
                 '**Ответственный орган:** Управление безопасности дорожного движения МВД (ГАИ).',
           'en': '## Driving licence\n'
                 '\n'
                 'To obtain a new licence or renew an expired one, follow these steps.\n'
                 '\n'
                 '1. **Application:** submit online via the unified portal.\n'
                 '2. **Documents:** attach your passport and medical certificate.\n'
                 '3. **Payment:** pay the state fee online.\n'
                 '4. **Exam:** if required, pass the theory and practical tests.\n'
                 '5. **Collection:** pick up the ready licence at the assigned office.\n'
                 '\n'
                 '**Responsible body:** Road Traffic Safety Department of the Ministry of Internal '
                 'Affairs (YHXX/GAI).'}},
 {'slug': 'vehicle-registration',
  'category': 'transport',
  'tags': ['vehicle', 'registration', 'purchase'],
  'order': 2,
  'source_url': 'https://my.gov.uz',
  'title': {'uz': "Transport vositasini ro'yxatdan o'tkazish",
            'ru': 'Регистрация транспортного средства',
            'en': 'Vehicle registration'},
  'body': {'uz': "## Transport vositasini ro'yxatga olish\n"
                 '\n'
                 "Yangi yoki sotib olingan avtomobilni ro'yxatdan o'tkazish yoki qayta "
                 'rasmiylashtirish tartibi.\n'
                 '\n'
                 '1. **Yozilish:** portal orqali navbat oling.\n'
                 '2. **Hujjatlar:** oldi-sotdi shartnomasi va pasportni tayyorlang.\n'
                 "3. **Ko'rik:** transport vositasini texnik ko'rikdan o'tkazing.\n"
                 "4. **To'lov:** boj va yig'imlarni to'lang.\n"
                 "5. **Guvohnoma:** ro'yxatdan o'tkazish guvohnomasini oling.\n"
                 '\n'
                 "**Mas'ul organ:** IIV Yo'l harakati xavfsizligi boshqarmasi (YHXX).",
           'ru': '## Регистрация автомобиля\n'
                 '\n'
                 'Порядок постановки на учёт нового или купленного автомобиля и его '
                 'перерегистрации.\n'
                 '\n'
                 '1. **Запись:** возьмите очередь через портал.\n'
                 '2. **Документы:** подготовьте договор купли-продажи и паспорт.\n'
                 '3. **Осмотр:** пройдите технический осмотр машины.\n'
                 '4. **Оплата:** внесите пошлины и сборы.\n'
                 '5. **Свидетельство:** получите свидетельство о регистрации.\n'
                 '\n'
                 '**Ответственный орган:** Управление безопасности дорожного движения МВД (ГАИ).',
           'en': '## Vehicle registration\n'
                 '\n'
                 'How to register a new or purchased car and re-register it after a change of '
                 'owner.\n'
                 '\n'
                 '1. **Booking:** take a queue slot via the portal.\n'
                 '2. **Documents:** prepare the sale contract and your passport.\n'
                 '3. **Inspection:** pass the technical inspection of the vehicle.\n'
                 '4. **Payment:** pay the duties and fees.\n'
                 '5. **Certificate:** receive the registration certificate.\n'
                 '\n'
                 '**Responsible body:** Road Traffic Safety Department of the Ministry of Internal '
                 'Affairs (YHXX/GAI).'}},
 {'slug': 'number-plates',
  'category': 'transport',
  'tags': ['plates', 'number', 'replacement'],
  'order': 3,
  'source_url': 'https://my.gov.uz',
  'title': {'uz': 'Davlat raqam belgilarini olish yoki almashtirish',
            'ru': 'Получение или замена государственных номерных знаков',
            'en': 'Obtaining or replacing number plates'},
  'body': {'uz': '## Davlat raqam belgilari\n'
                 '\n'
                 "Yangi raqam belgilarini olish yoki yo'qolgan hamda shikastlanganini almashtirish "
                 'tartibi.\n'
                 '\n'
                 '1. **Ariza:** portal orqali xizmatni tanlang.\n'
                 "2. **Hujjatlar:** ro'yxat guvohnomasi va pasportni biriktiring.\n"
                 "3. **To'lov:** yig'imni onlayn amalga oshiring.\n"
                 "4. **Tanlov:** kerak bo'lsa raqam kombinatsiyasini tanlang.\n"
                 "5. **Olish:** tayyor belgilarni bo'limdan oling.\n"
                 '\n'
                 "**Mas'ul organ:** IIV Yo'l harakati xavfsizligi boshqarmasi (YHXX).",
           'ru': '## Государственные номерные знаки\n'
                 '\n'
                 'Порядок получения новых номеров или замены утерянных и повреждённых знаков.\n'
                 '\n'
                 '1. **Заявление:** выберите услугу через портал.\n'
                 '2. **Документы:** приложите свидетельство о регистрации и паспорт.\n'
                 '3. **Оплата:** внесите сбор онлайн.\n'
                 '4. **Выбор:** при желании выберите комбинацию номера.\n'
                 '5. **Получение:** заберите готовые знаки в отделении.\n'
                 '\n'
                 '**Ответственный орган:** Управление безопасности дорожного движения МВД (ГАИ).',
           'en': '## Number plates\n'
                 '\n'
                 'How to obtain new plates or replace lost and damaged ones.\n'
                 '\n'
                 '1. **Application:** choose the service via the portal.\n'
                 '2. **Documents:** attach the registration certificate and passport.\n'
                 '3. **Payment:** pay the fee online.\n'
                 '4. **Selection:** optionally choose a number combination.\n'
                 '5. **Collection:** pick up the ready plates at the office.\n'
                 '\n'
                 '**Responsible body:** Road Traffic Safety Department of the Ministry of Internal '
                 'Affairs (YHXX/GAI).'}},
 {'slug': 'pay-traffic-fines',
  'category': 'transport',
  'tags': ['fines', 'payment', 'online'],
  'order': 4,
  'source_url': 'https://my.gov.uz',
  'title': {'uz': "Yo'l jarimalarini tekshirish va to'lash",
            'ru': 'Проверка и оплата дорожных штрафов',
            'en': 'Checking and paying traffic fines'},
  'body': {'uz': "## Yo'l jarimalari\n"
                 '\n'
                 "Tayinlangan jarimalarni onlayn tekshirish va to'lash uchun quyidagicha harakat "
                 'qiling.\n'
                 '\n'
                 '1. **Kirish:** portalga shaxsingizni tasdiqlab kiring.\n'
                 "2. **Qidiruv:** guvohnoma yoki avtomobil raqami bo'yicha jarimalarni ko'ring.\n"
                 "3. **Tekshirish:** qoidabuzarlik tafsilotlarini o'qing.\n"
                 "4. **To'lov:** to'lov kartasi orqali onlayn to'lang.\n"
                 '5. **Kvitansiya:** elektron kvitansiyani saqlang.\n'
                 '\n'
                 "**Mas'ul organ:** IIV Yo'l harakati xavfsizligi boshqarmasi (YHXX).",
           'ru': '## Дорожные штрафы\n'
                 '\n'
                 'Чтобы проверить и оплатить начисленные штрафы онлайн, действуйте так.\n'
                 '\n'
                 '1. **Вход:** войдите на портал с подтверждением личности.\n'
                 '2. **Поиск:** найдите штрафы по удостоверению или номеру машины.\n'
                 '3. **Проверка:** ознакомьтесь с деталями нарушения.\n'
                 '4. **Оплата:** оплатите онлайн платёжной картой.\n'
                 '5. **Квитанция:** сохраните электронную квитанцию.\n'
                 '\n'
                 '**Ответственный орган:** Управление безопасности дорожного движения МВД (ГАИ).',
           'en': '## Traffic fines\n'
                 '\n'
                 'To check and pay issued fines online, proceed as follows.\n'
                 '\n'
                 '1. **Sign in:** log in to the portal with identity verification.\n'
                 '2. **Search:** find fines by licence or vehicle number.\n'
                 '3. **Review:** read the details of the violation.\n'
                 '4. **Payment:** pay online with a payment card.\n'
                 '5. **Receipt:** save the electronic receipt.\n'
                 '\n'
                 '**Responsible body:** Road Traffic Safety Department of the Ministry of Internal '
                 'Affairs (YHXX/GAI).'}},
 {'slug': 'driving-medical-check',
  'category': 'transport',
  'tags': ['medical', 'exam', 'theory'],
  'order': 5,
  'source_url': 'https://my.gov.uz',
  'title': {'uz': "Tibbiy ko'rik va haydovchilik imtihonlari",
            'ru': 'Медосмотр и экзамены на водительские права',
            'en': 'Medical check and driving exams'},
  'body': {'uz': "## Tibbiy ko'rik va imtihonlar\n"
                 '\n'
                 "Guvohnoma olish uchun tibbiy ko'rik hamda nazariy va amaliy sinovlar talab "
                 'qilinadi.\n'
                 '\n'
                 "1. **Yozilish:** portal orqali ko'rikka navbat oling.\n"
                 "2. **Tibbiy ko'rik:** shifokorlardan xulosa oling.\n"
                 "3. **Nazariya:** yo'l qoidalari bo'yicha testdan o'ting.\n"
                 '4. **Amaliyot:** avtodrom va shahar sinovini topshiring.\n'
                 "5. **Natija:** muvaffaqiyatdan so'ng guvohnoma rasmiylashtiriladi.\n"
                 '\n'
                 "**Mas'ul organ:** IIV Yo'l harakati xavfsizligi boshqarmasi (YHXX).",
           'ru': '## Медосмотр и экзамены\n'
                 '\n'
                 'Для получения прав требуются медицинский осмотр, а также теоретический и '
                 'практический экзамены.\n'
                 '\n'
                 '1. **Запись:** возьмите очередь на осмотр через портал.\n'
                 '2. **Медосмотр:** получите заключение врачей.\n'
                 '3. **Теория:** сдайте тест по правилам движения.\n'
                 '4. **Практика:** пройдите экзамен на автодроме и в городе.\n'
                 '5. **Результат:** после успеха оформляется удостоверение.\n'
                 '\n'
                 '**Ответственный орган:** Управление безопасности дорожного движения МВД (ГАИ).',
           'en': '## Medical check and exams\n'
                 '\n'
                 'A licence requires a medical examination plus theory and practical driving '
                 'tests.\n'
                 '\n'
                 '1. **Booking:** take a queue slot for the exam via the portal.\n'
                 "2. **Medical:** obtain the doctors' certificate.\n"
                 '3. **Theory:** pass the road-rules test.\n'
                 '4. **Practical:** take the track and city driving exam.\n'
                 '5. **Result:** on success the licence is issued.\n'
                 '\n'
                 '**Responsible body:** Road Traffic Safety Department of the Ministry of Internal '
                 'Affairs (YHXX/GAI).'}},
 {'slug': 'temporary-residence-registration',
  'category': 'residence',
  'tags': ['temporary', 'stay', 'hotel'],
  'order': 1,
  'source_url': 'https://my.gov.uz',
  'title': {'uz': "Vaqtinchalik yashash manzilida ro'yxatga olish",
            'ru': 'Регистрация по месту временного пребывания',
            'en': 'Temporary residence registration'},
  'body': {'uz': "## Vaqtinchalik yashash manzilida ro'yxatga olish\n"
                 '\n'
                 '**Bu nima:** Doimiy manzilingizdan boshqa joyda yashaganingizda vaqtinchalik '
                 "turar joyda ro'yxatdan o'tish.\n"
                 '\n'
                 '**Kim amalga oshiradi:**\n'
                 "1. Mehmonxonada to'xtagan turistlarni mehmonxona avtomatik ro'yxatga oladi.\n"
                 "2. Boshqalar migratsiya va ro'yxatga olish bo'limi yoki onlayn portal orqali "
                 'murojaat qiladi.\n'
                 '3. Pasport va uy egasi roziligini taqdim eting.\n'
                 '\n'
                 "Ro'yxat belgilangan muddatga qonuniy yashashni tasdiqlaydi va uzaytirilishi "
                 'mumkin.\n'
                 '\n'
                 "**Mas'ul organ:** Ichki ishlar vazirligi (IIV), migratsiya va ro'yxatga olish "
                 'organi.',
           'ru': '## Регистрация по месту временного пребывания\n'
                 '\n'
                 '**Что это:** Регистрация по месту временного пребывания, когда вы живёте не по '
                 'постоянному адресу.\n'
                 '\n'
                 '**Кто оформляет:**\n'
                 '1. Туристов в гостиницах регистрирует сама гостиница автоматически.\n'
                 '2. Остальные обращаются в отдел миграции и регистрации или через онлайн-портал.\n'
                 '3. Предъявите паспорт и согласие принимающей стороны.\n'
                 '\n'
                 'Регистрация подтверждает законное пребывание на установленный срок и может '
                 'продлеваться.\n'
                 '\n'
                 '**Ответственный орган:** Министерство внутренних дел (МВД), орган миграции и '
                 'регистрации.',
           'en': '## Temporary residence registration\n'
                 '\n'
                 '**What it is:** Registration at your temporary place of stay when you live '
                 'somewhere other than your permanent address.\n'
                 '\n'
                 '**Who does it:**\n'
                 '1. Tourists staying in hotels are registered automatically by the hotel.\n'
                 '2. Others apply through the migration and registration office or the online '
                 'portal.\n'
                 "3. Bring your passport and the host's consent.\n"
                 '\n'
                 'Registration confirms your lawful stay for a set period and can be renewed.\n'
                 '\n'
                 '**Responsible body:** Ministry of Internal Affairs (IIV), migration and '
                 'registration authority.'}},
 {'slug': 'permanent-residence-registration',
  'category': 'residence',
  'tags': ['permanent', 'propiska', 'address'],
  'order': 2,
  'source_url': 'https://my.gov.uz',
  'title': {'uz': "Doimiy yashash joyida ro'yxatga olish",
            'ru': 'Регистрация по постоянному месту жительства',
            'en': 'Permanent residence registration'},
  'body': {'uz': "## Doimiy yashash joyida ro'yxatga olish\n"
                 '\n'
                 '**Bu nima:** Doimiy manzilingizni (propiska) rasmiylashtirish, u sizni rasmiy '
                 "yashash joyingizga bog'laydi.\n"
                 '\n'
                 '**Qanday murojaat qilinadi:**\n'
                 "1. Migratsiya va ro'yxatga olish bo'limiga yoki onlayn ariza topshiring.\n"
                 '2. Pasport va uy-joyga huquqni tasdiqlovchi hujjatlarni taqdim eting.\n'
                 "3. Uy siznikimas bo'lsa, mulkdor roziligini oling.\n"
                 '\n'
                 "Doimiy ro'yxat qayd etiladi va mahalliy xizmatlardan foydalanishga ta'sir "
                 'qiladi.\n'
                 '\n'
                 "**Mas'ul organ:** Ichki ishlar vazirligi (IIV), migratsiya va ro'yxatga olish "
                 'organi.',
           'ru': '## Регистрация по постоянному месту жительства\n'
                 '\n'
                 '**Что это:** Оформление постоянного адреса (прописка), который связывает вас с '
                 'официальным местом проживания.\n'
                 '\n'
                 '**Как оформить:**\n'
                 '1. Подайте заявление в отдел миграции и регистрации или онлайн.\n'
                 '2. Предоставьте паспорт и документы, подтверждающие право на жильё.\n'
                 '3. Получите согласие собственника, если жильё не ваше.\n'
                 '\n'
                 'Постоянная регистрация фиксируется и влияет на доступ к местным услугам.\n'
                 '\n'
                 '**Ответственный орган:** Министерство внутренних дел (МВД), орган миграции и '
                 'регистрации.',
           'en': '## Permanent residence registration\n'
                 '\n'
                 '**What it is:** Registering your permanent address (propiska), which links you '
                 'to your official place of living.\n'
                 '\n'
                 '**How to apply:**\n'
                 '1. Submit an application at the migration and registration office or online.\n'
                 '2. Provide your passport and documents proving the right to the housing.\n'
                 '3. Get consent from the property owner if it is not yours.\n'
                 '\n'
                 'Permanent registration is recorded and affects access to local services.\n'
                 '\n'
                 '**Responsible body:** Ministry of Internal Affairs (IIV), migration and '
                 'registration authority.'}},
 {'slug': 'change-registered-address',
  'category': 'residence',
  'tags': ['move', 'address', 'update'],
  'order': 3,
  'source_url': 'https://my.gov.uz',
  'title': {'uz': "Ro'yxatdagi manzilni o'zgartirish",
            'ru': 'Изменение адреса регистрации',
            'en': 'Changing your registered address'},
  'body': {'uz': "## Ro'yxatdagi manzilni o'zgartirish\n"
                 '\n'
                 "**Bu nima:** Yangi yashash joyiga ko'chganingizda ro'yxatingizni yangilash.\n"
                 '\n'
                 '**Qanday amalga oshiriladi:**\n'
                 "1. Migratsiya va ro'yxatga olish bo'limiga yoki onlayn portal orqali murojaat "
                 'qiling.\n'
                 '2. Pasport va yangi manzil hujjatlarini taqdim eting.\n'
                 "3. Eski manzildan chiqarilib, yangi manzilga qo'shilasiz.\n"
                 '\n'
                 "Manzilni yangilab turish to'g'ri qayd va xizmatlardan foydalanishni "
                 "ta'minlaydi.\n"
                 '\n'
                 "**Mas'ul organ:** Ichki ishlar vazirligi (IIV), migratsiya va ro'yxatga olish "
                 'organi.',
           'ru': '## Изменение адреса регистрации\n'
                 '\n'
                 '**Что это:** Обновление регистрации при переезде на новое место жительства.\n'
                 '\n'
                 '**Как оформить:**\n'
                 '1. Обратитесь в отдел миграции и регистрации или через онлайн-портал.\n'
                 '2. Предоставьте паспорт и документы на новый адрес.\n'
                 '3. Вас снимают со старого адреса и ставят на новый.\n'
                 '\n'
                 'Актуальный адрес обеспечивает правильные записи и доступ к услугам.\n'
                 '\n'
                 '**Ответственный орган:** Министерство внутренних дел (МВД), орган миграции и '
                 'регистрации.',
           'en': '## Changing your registered address\n'
                 '\n'
                 '**What it is:** Updating your registration when you move to a new place of '
                 'living.\n'
                 '\n'
                 '**How to do it:**\n'
                 '1. Apply at the migration and registration office or through the online portal.\n'
                 '2. Provide your passport and documents for the new address.\n'
                 '3. You are removed from the old address and added to the new one.\n'
                 '\n'
                 'Keeping your address current ensures correct records and access to services.\n'
                 '\n'
                 '**Responsible body:** Ministry of Internal Affairs (IIV), migration and '
                 'registration authority.'}},
 {'slug': 'newborn-registration',
  'category': 'residence',
  'tags': ['newborn', 'child', 'family'],
  'order': 4,
  'source_url': 'https://my.gov.uz',
  'title': {'uz': "Yangi tug'ilgan chaqaloqni ro'yxatga olish",
            'ru': 'Регистрация новорождённого',
            'en': 'Registering a newborn'},
  'body': {'uz': "## Yangi tug'ilgan chaqaloqni ro'yxatga olish\n"
                 '\n'
                 "**Bu nima:** Yangi tug'ilgan bolani oilaning ro'yxatdagi manziliga qo'shish.\n"
                 '\n'
                 '**Qanday amalga oshiriladi:**\n'
                 "1. Bolaning tug'ilganlik guvohnomasi va ota-onaning pasportlarini tayyorlang.\n"
                 "2. Migratsiya va ro'yxatga olish bo'limiga yoki onlayn portalga murojaat "
                 'qiling.\n'
                 "3. Bola ota-onaning manzilida ro'yxatga olinadi.\n"
                 '\n'
                 "Erta ro'yxat tibbiy yordam, imtiyozlar va kelgusi hujjatlarga yordam beradi.\n"
                 '\n'
                 "**Mas'ul organ:** Ichki ishlar vazirligi (IIV), migratsiya va ro'yxatga olish "
                 'organi.',
           'ru': '## Регистрация новорождённого\n'
                 '\n'
                 '**Что это:** Постановка новорождённого ребёнка на регистрационный адрес семьи.\n'
                 '\n'
                 '**Как оформить:**\n'
                 '1. Подготовьте свидетельство о рождении и паспорта родителей.\n'
                 '2. Обратитесь в отдел миграции и регистрации или онлайн-портал.\n'
                 '3. Ребёнка регистрируют по адресу родителей.\n'
                 '\n'
                 'Ранняя регистрация помогает с медицинской помощью, льготами и будущими '
                 'документами.\n'
                 '\n'
                 '**Ответственный орган:** Министерство внутренних дел (МВД), орган миграции и '
                 'регистрации.',
           'en': '## Registering a newborn\n'
                 '\n'
                 "**What it is:** Adding a newborn child to the family's registered address.\n"
                 '\n'
                 '**How to do it:**\n'
                 "1. Prepare the child's birth certificate and the parents' passports.\n"
                 '2. Apply at the migration and registration office or the online portal.\n'
                 '3. The child is registered at the address of the parents.\n'
                 '\n'
                 'Early registration helps with medical care, benefits and future documents.\n'
                 '\n'
                 '**Responsible body:** Ministry of Internal Affairs (IIV), migration and '
                 'registration authority.'}},
 {'slug': 'deregistration',
  'category': 'residence',
  'tags': ['leaving', 'remove', 'address'],
  'order': 5,
  'source_url': 'https://my.gov.uz',
  'title': {'uz': "Manzildan ro'yxatdan chiqish",
            'ru': 'Снятие с регистрации по адресу',
            'en': 'Deregistration from an address'},
  'body': {'uz': "## Manzildan ro'yxatdan chiqish\n"
                 '\n'
                 "**Bu nima:** Manzilni butunlay tark etganingizda o'zingizni ro'yxatdan "
                 'chiqarish.\n'
                 '\n'
                 '**Qanday amalga oshiriladi:**\n'
                 "1. Migratsiya va ro'yxatga olish bo'limiga yoki onlayn portal orqali murojaat "
                 'qiling.\n'
                 "2. Pasportingizni taqdim eting va chiqish sababini ko'rsating.\n"
                 "3. O'sha manzildagi ro'yxatingiz bekor qilinadi.\n"
                 '\n'
                 "Ro'yxatdan chiqish ko'pincha yangi manzilga yozilish yoki chet elga chiqishdan "
                 "oldin kerak bo'ladi.\n"
                 '\n'
                 "**Mas'ul organ:** Ichki ishlar vazirligi (IIV), migratsiya va ro'yxatga olish "
                 'organi.',
           'ru': '## Снятие с регистрации по адресу\n'
                 '\n'
                 '**Что это:** Снятие себя с регистрационного адреса при окончательном выезде.\n'
                 '\n'
                 '**Как оформить:**\n'
                 '1. Обратитесь в отдел миграции и регистрации или через онлайн-портал.\n'
                 '2. Предъявите паспорт и укажите причину выезда.\n'
                 '3. Ваша регистрация по этому адресу аннулируется.\n'
                 '\n'
                 'Снятие часто требуется перед регистрацией по новому адресу или выездом за '
                 'рубеж.\n'
                 '\n'
                 '**Ответственный орган:** Министерство внутренних дел (МВД), орган миграции и '
                 'регистрации.',
           'en': '## Deregistration from an address\n'
                 '\n'
                 '**What it is:** Removing yourself from a registered address when you leave it '
                 'permanently.\n'
                 '\n'
                 '**How to do it:**\n'
                 '1. Apply at the migration and registration office or through the online portal.\n'
                 '2. Provide your passport and state the reason for leaving.\n'
                 '3. Your registration at that address is cancelled.\n'
                 '\n'
                 'Deregistration is often needed before registering at a new address or moving '
                 'abroad.\n'
                 '\n'
                 '**Responsible body:** Ministry of Internal Affairs (IIV), migration and '
                 'registration authority.'}}]

class Command(BaseCommand):
    help = "Seed the Scenario Catalog with trilingual sample data (idempotent)."

    @transaction.atomic
    def handle(self, *args, **options):
        cat_by_slug = {}
        for data in CATEGORIES:
            cat, created = Category.objects.update_or_create(
                slug=data["slug"],
                defaults={
                    "icon": data["icon"],
                    "name": data["name"],
                    "description": data["description"],
                    "order": data["order"],
                },
            )
            cat_by_slug[data["slug"]] = cat
            self.stdout.write(("  + " if created else "  ~ ") + f"category {cat.slug}")

        for data in SCENARIOS:
            body = {
                lang: text + DISCLAIMER[lang] for lang, text in data["body"].items()
            }
            scenario, created = Scenario.objects.update_or_create(
                slug=data["slug"],
                defaults={
                    "category": cat_by_slug[data["category"]],
                    "title": data["title"],
                    "body": body,
                    "source_url": data.get("source_url", ""),
                    "tags": data["tags"],
                    "order": data["order"],
                    "is_published": True,
                },
            )
            self.stdout.write(("  + " if created else "  ~ ") + f"scenario {scenario.slug}")

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(CATEGORIES)} categories and {len(SCENARIOS)} scenarios."
            )
        )
