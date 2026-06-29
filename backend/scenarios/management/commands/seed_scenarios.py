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

SCENARIOS = [
    {
        "slug": "passport-renewal",
        "category": "identity-documents",
        "tags": ["passport", "biometric", "renewal"],
        "order": 1,
        "title": {"uz": "Biometrik pasportni yangilash", "ru": "Замена биометрического паспорта", "en": "Renewing a biometric passport"},
        "body": {
            "uz": "## Biometrik pasportni yangilash\n\n**Kim uchun:** Amal qilish muddati tugagan yoki tugayotgan fuqarolar.\n\n**Odatda kerak bo'ladigan hujjatlar:**\n- Eski pasport\n- Tug'ilganlik haqida guvohnoma (zarur hollarda)\n- Davlat boji to'lovi kvitansiyasi\n\n**Qadamlar:**\n1. Davlat xizmatlari portali yoki yashash joyidagi IIB bo'limiga murojaat qiling.\n2. Ariza topshiring va biometrik ma'lumotlarni topshiring.\n3. Tayyor bo'lganda pasportni oling.\n\n**Mas'ul organ:** Ichki ishlar vazirligi (Migratsiya va fuqarolikni rasmiylashtirish).",
            "ru": "## Замена биометрического паспорта\n\n**Для кого:** Граждане с истёкшим или истекающим сроком действия.\n\n**Обычно требуется:**\n- Старый паспорт\n- Свидетельство о рождении (при необходимости)\n- Квитанция об оплате госпошлины\n\n**Шаги:**\n1. Обратитесь на портал госуслуг или в отдел МВД по месту жительства.\n2. Подайте заявление и сдайте биометрию.\n3. Получите готовый паспорт.\n\n**Ответственный орган:** Министерство внутренних дел (миграция и оформление гражданства).",
            "en": "## Renewing a biometric passport\n\n**Who:** Citizens whose passport has expired or is expiring.\n\n**Typically required:**\n- Old passport\n- Birth certificate (if requested)\n- Proof of state-fee payment\n\n**Steps:**\n1. Apply via the public-services portal or your local Internal Affairs office.\n2. Submit the application and provide biometric data.\n3. Collect the passport when ready.\n\n**Responsible body:** Ministry of Internal Affairs (migration & citizenship).",
        },
    },
    {
        "slug": "register-llc",
        "category": "business",
        "tags": ["company", "llc", "registration"],
        "order": 1,
        "title": {"uz": "MChJ ni ro'yxatdan o'tkazish", "ru": "Регистрация ООО", "en": "Registering an LLC"},
        "body": {
            "uz": "## MChJ (mas'uliyati cheklangan jamiyat) ni ro'yxatdan o'tkazish\n\n**Asosiy qadamlar:**\n1. Nom va ustav kapitalini belgilang.\n2. Ta'sis hujjatlarini tayyorlang.\n3. Davlat xizmatlari markazi yoki onlayn portal orqali ariza bering.\n4. STIR va bank hisob raqamini oching.\n\nKo'p hollarda ro'yxatdan o'tish bir necha ish kuni ichida amalga oshiriladi.\n\n**Mas'ul organ:** Davlat xizmatlari agentligi / soliq organlari.",
            "ru": "## Регистрация ООО\n\n**Основные шаги:**\n1. Определите название и уставный капитал.\n2. Подготовьте учредительные документы.\n3. Подайте заявление через ЦГУ или онлайн-портал.\n4. Получите ИНН и откройте банковский счёт.\n\nЧасто регистрация занимает несколько рабочих дней.\n\n**Ответственный орган:** Агентство госуслуг / налоговые органы.",
            "en": "## Registering an LLC\n\n**Core steps:**\n1. Choose a name and charter capital.\n2. Prepare founding documents.\n3. Apply via a Public Services Centre or the online portal.\n4. Obtain a TIN and open a bank account.\n\nRegistration often completes within a few business days.\n\n**Responsible body:** Public Services Agency / tax authorities.",
        },
    },
    {
        "slug": "personal-tin",
        "category": "taxes",
        "tags": ["tin", "tax", "individual"],
        "order": 1,
        "title": {"uz": "Jismoniy shaxs uchun STIR olish", "ru": "Получение ИНН физлица", "en": "Getting a personal TIN"},
        "body": {
            "uz": "## Jismoniy shaxs uchun STIR\n\nSTIR (soliq to'lovchining identifikatsiya raqami) ish bilan ta'minlash, bank va tadbirkorlik uchun kerak bo'ladi.\n\n**Olish yo'li:** Soliq qo'mitasining rasmiy portali yoki yaqin soliq bo'limi orqali, shaxsni tasdiqlovchi hujjat bilan.\n\n**Mas'ul organ:** Soliq qo'mitasi.",
            "ru": "## ИНН физического лица\n\nИНН нужен для трудоустройства, банковских операций и предпринимательства.\n\n**Как получить:** через портал Налогового комитета или ближайшую налоговую инспекцию с документом, удостоверяющим личность.\n\n**Ответственный орган:** Налоговый комитет.",
            "en": "## Personal TIN\n\nA TIN (taxpayer identification number) is needed for employment, banking and business.\n\n**How to get it:** via the Tax Committee portal or your nearest tax office, with an identity document.\n\n**Responsible body:** Tax Committee.",
        },
    },
    {
        "slug": "emergency-medical",
        "category": "healthcare",
        "tags": ["emergency", "ambulance", "103"],
        "order": 1,
        "title": {"uz": "Shoshilinch tibbiy yordam", "ru": "Экстренная медицинская помощь", "en": "Emergency medical help"},
        "body": {
            "uz": "## Shoshilinch tibbiy yordam\n\n**Tez yordam raqami: 103** (yoki yagona 112).\n\nShoshilinch holatlarda davlat shifoxonalarida birlamchi yordam ko'rsatiladi. Chet el fuqarolari uchun sug'urta talab qilinishi mumkin.\n\n**Mas'ul organ:** Sog'liqni saqlash vazirligi.",
            "ru": "## Экстренная медицинская помощь\n\n**Скорая помощь: 103** (или единый 112).\n\nВ экстренных случаях государственные больницы оказывают первичную помощь. Для иностранцев может потребоваться страховка.\n\n**Ответственный орган:** Министерство здравоохранения.",
            "en": "## Emergency medical help\n\n**Ambulance: 103** (or unified 112).\n\nIn emergencies, state hospitals provide primary care. Insurance may be required for foreign nationals.\n\n**Responsible body:** Ministry of Health.",
        },
    },
    {
        "slug": "tourist-visa",
        "category": "visa-migration",
        "tags": ["visa", "tourist", "e-visa"],
        "order": 1,
        "title": {"uz": "Sayyohlik vizasi (E-VIZA)", "ru": "Туристическая виза (E-VISA)", "en": "Tourist visa (E-VISA)"},
        "body": {
            "uz": "## Sayyohlik vizasi\n\nKo'plab davlatlar fuqarolari uchun vizasiz rejim yoki elektron viza (E-VIZA) amal qiladi.\n\n**Qadamlar:**\n1. Rasmiy E-VIZA portalida ariza to'ldiring.\n2. To'lovni amalga oshiring.\n3. Tasdiqlangan vizani elektron pochta orqali oling.\n\n**Mas'ul organ:** Tashqi ishlar vazirligi.",
            "ru": "## Туристическая виза\n\nДля граждан многих стран действует безвизовый режим или электронная виза (E-VISA).\n\n**Шаги:**\n1. Заполните заявку на официальном портале E-VISA.\n2. Оплатите сбор.\n3. Получите подтверждённую визу по электронной почте.\n\n**Ответственный орган:** Министерство иностранных дел.",
            "en": "## Tourist visa\n\nMany nationalities enjoy visa-free entry or can apply for an electronic visa (E-VISA).\n\n**Steps:**\n1. Complete the application on the official E-VISA portal.\n2. Pay the fee.\n3. Receive the approved visa by email.\n\n**Responsible body:** Ministry of Foreign Affairs.",
        },
    },
    {
        "slug": "drivers-license",
        "category": "transport",
        "tags": ["driving", "license", "exam"],
        "order": 1,
        "title": {"uz": "Haydovchilik guvohnomasini olish", "ru": "Получение водительских прав", "en": "Getting a driving licence"},
        "body": {
            "uz": "## Haydovchilik guvohnomasi\n\n**Qadamlar:**\n1. Avtomaktabda o'qishni tugating.\n2. Tibbiy ko'rikdan o'ting.\n3. Nazariy va amaliy imtihonlarni topshiring.\n4. Guvohnomani oling.\n\n**Mas'ul organ:** Ichki ishlar vazirligi (YHXB).",
            "ru": "## Водительские права\n\n**Шаги:**\n1. Окончите автошколу.\n2. Пройдите медосмотр.\n3. Сдайте теоретический и практический экзамены.\n4. Получите права.\n\n**Ответственный орган:** МВД (служба безопасности дорожного движения).",
            "en": "## Driving licence\n\n**Steps:**\n1. Complete a driving school course.\n2. Pass a medical check.\n3. Pass the theory and practical exams.\n4. Receive the licence.\n\n**Responsible body:** Ministry of Internal Affairs (road safety service).",
        },
    },
    {
        "slug": "temporary-residence-registration",
        "category": "residence",
        "tags": ["registration", "propiska", "foreigner"],
        "order": 1,
        "title": {"uz": "Vaqtinchalik yashash joyini ro'yxatga olish", "ru": "Временная регистрация по месту пребывания", "en": "Temporary residence registration"},
        "body": {
            "uz": "## Vaqtinchalik ro'yxatga olish\n\nChet el fuqarolari kelganidan so'ng belgilangan muddatda yashash joyini ro'yxatdan o'tkazishlari kerak. Mehmonxonalar buni avtomatik amalga oshiradi.\n\n**Mas'ul organ:** Ichki ishlar vazirligi (Migratsiya).",
            "ru": "## Временная регистрация\n\nИностранные граждане должны зарегистрироваться по месту пребывания в установленный срок после прибытия. Гостиницы делают это автоматически.\n\n**Ответственный орган:** МВД (миграция).",
            "en": "## Temporary registration\n\nForeign nationals must register their place of stay within the set period after arrival. Hotels do this automatically.\n\n**Responsible body:** Ministry of Internal Affairs (migration).",
        },
    },
]


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
