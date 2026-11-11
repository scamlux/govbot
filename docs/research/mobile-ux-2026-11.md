# GovBot: исследование UX мобильного приложения
**Республика Узбекистан · ноябрь 2026**

## Резюме

Мобильное приложение GovBot должно конкурировать с успешными цифровыми сервисами государств (Диia, Singpass, GOV.UK), одновременно учитывая уникальные ограничения Узбекистана: 83% Android рыночной доли, роль Telegram как основного канала информации, разнообразный возраст аудитории (включая пожилых граждан), двойную письменность (латинский и кириллический узбекский). Исследование рекомендует 25+ конкретных решений по навигации, дизайну чата, оффлайн-поддержке, доступности, персонализации, включая анимацию (Spring damping 1.0, response 0.3–0.4), сокращённый ввод текста, прямую интеграцию OneID, поддержку Payme/Click, минималистичный интерфейс для низкой грамотности.

---

## 1. Анализ эталонных государственных приложений

### 1.1 Диia (Украина) — красный флаг: NFC и биометрия

**Навигация:** 4-вкладочная: Feed → Documents → Services → Menu.
- **Положительное:** простая блочная раскладка, поддержка офлайна, работает на старых устройствах.
- **Проблемы (App Store/Google Play, 2024–2025):**
  - NFC-чип не читается 99 из 100 раз.
  - Биометрическое сканирование паспорта повторно падает с разными ошибками.
  - Документы исчезают без возможности восстановления.
  - Поддержка недостижима.

**Вывод:** инвестировать в надёжное сканирование; предусмотреть fallback, если биометрия не сработала.

*Источники:* [Diia App Store](https://apps.apple.com/us/app/%D0%B4%D1%96%D1%8F/id1489717872), [Диia на Red Dot Award](https://www.red-dot.org/project/diia-20-55273), [UX Design Awards](https://ux-design-awards.com/winners/2023-2-diia-app)

### 1.2 Singpass (Сингапур) — модель быстрого входа

**Ключи:**
- Login Shortcuts на главном экране (CPF, HDB, NS Portal).
- Нижняя вкладка Inbox для уведомлений от органов.
- Маскирование чувствительных данных.
- Доступность для слабовидящих.
- Multi-User SMS 2FA для пользователей без смартфона.

**Вывод:** быстрые ярлыки избранных сервисов снижают трение входа; SMS 2FA критична для старшего возраста.

*Источники:* [Singpass Medium](https://medium.com/ndi-sg/not-just-for-logging-in-redesigning-singapores-digital-identity-app-545c08d820bb), [GovTech Singpass](https://www.tech.gov.sg/technews/three-ways-singpass-mobile-app-makes-your-life-easier/)

### 1.3 GOV.UK App (2025) — домашняя страница как органайзер

**Структура:**
- Избранные темы + добавление местного органа власти.
- Топ: Benefits, Driving, Money/Tax.
- История просмотров, предыдущие поиски для возврата.
- 46% пользователей — постоянные; 85% добавили избранное.

**UX обновления (v5.11.0, июнь 2025):**
- Service navigation улучшена для мобилей.
- Инверсный цвет для доступности.

**Вывод:** напоминание о рецентности (недавних действиях) снижает когнитивную нагрузку; избранное — критичная фишка.

*Источники:* [GOV.UK App 2025](https://www.publictechnology.net/2025/07/01/society-and-welfare/gov-uk-app-launches-nationwide/), [GDS blog](https://insidegovuk.blog.gov.uk/2026/01/28/how-people-used-gov-uk-in-2025/)

### 1.4 Госуслуги (Россия) — навигация через AI-ассистента

**Архитектура:**
- Главный экран: информационный иерархия, не витрина.
- AI-ассистент помогает найти услугу из 500+.
- Система дизайна (Storybook) синхронизирует дизайн–фронтенд на 40%.
- Progressive disclosure: контекстные подсказки вместо всех сервисов сразу.

**Недостатки (редизайн Habr, 2021):**
- 4 кнопки платежей на главной, остальные требуют скролла — плохо для дискавери.

**Вывод:** умный поиск + ассистент заменяет списки; дизайн-система экономит время.

*Источники:* [Habr: Госуслуги редизайн](https://habr.com/ru/articles/546966/), [Госуслуги на Google Play](https://play.google.com/store/apps/details?id=ru.rostel)

### 1.5 TAMM & UAE Pass (ОАЭ) — персонализация через виджеты

**TAMM (Абу-Даби):**
- Главная с виджетами (штрафы, счета).
- Edit-режим: добавить/удалить виджеты.
- TAMM Spaces: сгруппированные по темам (жильё, бизнес, здоровье).
- 750+ услуг, но структурированы по контексту.

**Вывод:** скрытие неуместных услуг через Spaces снижает когнитивную нагрузку; персонализация через виджеты — UX победа.

*Источники:* [TAMM Abu Dhabi](https://gulfnews.com/living-in-uae/ask-us/uae-access-over-750-abu-dhabi-government-services-on-one-platform---the-tamm-app-1.1697637964634), [UAE Design System](https://designsystem.gov.ae/guidelines/mobile-applications)

### 1.6 my.gov.uz (Узбекистан) — собственный опыт

**Текущее состояние:**
- 12 млн пользователей, 780+ услуг.
- Переработана главная: новые виджеты, лучше упорядочены категории.
- Распространены другие приложения (DMED, LexUZ, Adliya Plus).

**Недостаток:** нет публичных UX case studies или дизайн-системы.

**Вывод:** GovBot может заимствовать архитектуру my.gov.uz, улучшив дизайн доступности и оффлайна.

*Источники:* [MyGov App Store](https://apps.apple.com/uz/app/mygov-davlat-xizmatlari/id1544175166)

---

## 2. Анализ AI-ассистентов: чат-интерфейсы

### 2.1 ChatGPT Mobile — потоковая доставка текста

**Ключевые паттерны:**
- **Потоковый текст:** каждый токен выводится по мере генерации (не ждём полный ответ).
- **Typing indicator:** три анимированные точки, пока ответ готовится.
- **Истории чатов:** боковая панель (на планшете) или нижний список.
- **Composer:** закреплён внизу (dock), сообщение обёрнуто Keyboard-animation для плавного подъёма.
- **Attachments:** загрузка файлов, голос (Voice Mode).

**Вывод для GovBot:** потоковая доставка ответов создаёт ощущение живого диалога; стоковые компоненты (Stream Chat SDK для Compose/React) ускоряют разработку.

*Источники:* [ChatGPT Mobile UX](https://medium.com/@akshatkhare707/chatgpt-mobile-app-ui-ux-case-study-eb93051cf3b4), [Stream AI SDK](https://getstream.io/chat/solutions/ai-integration/)

### 2.2 Claude Mobile — цитаты и Docs/Slides интеграция

**Отличия:**
- Потоковые ответы с markdown-рендером.
- **Inline Citations:** источники показаны встроенными, не в отдельной панели.
- Новая особенность (бета, 2025): слияние Chat + Claude Docs + Claude Slides в один UI.
- Поддержка Mobile Web (недавно выпущена).

**Вывод для GovBot:** встроенные ссылки на источники (gov.uz, lex.uz) критичны для доверия; Docs-интеграция подойдёт для документов-чек-листов.

*Источники:* [Claude App Store](https://apps.apple.com/us/app/claude-by-anthropic/id6473753684), [Design Critique Claude](https://ixd.prattsi.org/2026/02/design-critique-claude-mobile-app/), [Anthropic AI SDK Chat](https://www.aisdkagents.com/patterns/chat-claude)

### 2.3 Perplexity vs Gemini — источники vs отчёт

| Аспект | Perplexity | Gemini |
|--------|-----------|--------|
| **Макет источников** | Two-panel: чат слева, детали справа | Separated: отчёт в основном окне |
| **Дизайн** | Фокус на читаемости источников | "Neural Expressive": glow-эффект, современный |
| **Live-режим** | Voice input–output | Gemini Live: копировать/делиться без закрытия |
| **Процесс** | Видимая генерация в реальном времени | Финальный отчёт |

**Вывод:** Perplexity лучше для высокой видимости источников (критично для гос. сервиса); Gemini лучше для финального отчёта/справки.

*Источники:* [Deep Research UI сравнение](https://dev.to/franciscomoretti/deep-research-uis-perplexity-vs-manus-vs-chatgpt-vs-gemini-5cc2), [Gemini Neural Expressive](https://8bittoast.com/google-gemini-major-visual-redesign/)

---

## 3. Движение и микровзаимодействия

### 3.1 Material 3 Expressive Motion (2025)

**Spring Parameters (Flutter/Material):**
| Параметр | Expressive | Standard |
|----------|-----------|----------|
| Fast spatial | 0.6 damping, 800 ms | 0.9 damping, 1400 ms |
| Default spatial | 0.8 damping, 380 ms | 0.9 damping, 700 ms |
| Slow spatial | 0.8 damping, 200 ms | 0.9 damping, 300 ms |

**Применение:**
- **Быстрое** (Fast): quick confirmations, dismiss actions.
- **Стандартное** (Default): navigation transitions, content reveal.
- **Медленное** (Slow): emphasis animations, important state changes.

*Источник:* Material Design 3 Motion

### 3.2 iOS Spring Animation (UIView.animate, SwiftUI)

**Рекомендуемые параметры:**
- **Damping:** 1.0 (критически затухающий, без отскока).
- **Response:** 0.3–0.4 (быстрый отклик).
- **Для отскока:** damping ~0.8, response 0.3–0.4 (слегка underdamped).

**Жизненный цикл:**
```swift
generator.prepare()      // Инициализация
// -> Spring starts
generator.impactOccurred() // Мягкий/жёсткий удар
// -> Animate to settle time (1–2 frames)
```

*Источник:* [iOS Haptics GitHub](https://github.com/emilkowalski/skills/blob/main/skills/apple-design/SKILL.md)

### 3.3 Skeleton Screens & Shimmer

**Принципы:**
- Используй скелет только если load > 500 ms.
- Flash-проблема: если API отвечает в < 300 ms, скелет вызывает раздражение.
- Shimmer: gradient sweep за 1.5–2 сек (repeating).
- Accessibility: `prefers-reduced-motion` = статичный тинт (без анимации).

**Макет:**
- Text → разной ширины bars.
- Images → boxes с правильным aspect ratio.
- Avatars → circles.

*Источник:* [Skeleton Screens Guide](https://medium.com/design-bootcamp/the-ultimate-guide-to-skeleton-screens-in-modern-ui-design-4df362615113)

### 3.4 Bottom Sheets & Detents

**iOS 16+:**
- Любое число detents (точек остановки): `.fraction(0.5)`, `.large()` или custom.
- Grabber (область захвата) видна по умолчанию.
- Physics: 0.55 rubber band (iOS tracks finger).

**Android:**
- Макс 3 detent: `expandedOffset`, `halfExpandedRatio`, `peekHeight`.
- Нет встроенного grabber-аналога.

**Cross-Platform (Expo, MAUI):**
- Expo Router FormSheet: iOS — любое число detents, Android — макс 3.
- Accessibility: всегда добавь видимую Close-кнопку (не только gesture).

*Источники:* [Bottom Sheets SwiftUI](https://21zerixpm.medium.com/bottom-sheets-in-swiftui-modal-presentations-done-right-bc4ab6825d02), [Expo Form Sheet](https://docs.expo.dev/)

### 3.5 Pull-to-Refresh

**Истоки:** Loren Brichter, Tweetie (2008).
**Применение:** социальные ленты, inbox, контент-обновления.
**Когда НЕ использовать:** статические страницы с автообновлением, редкие обновления.
**Conflicting gestures:** рисующее приложение + downward pull = конфликт; решение — disable on specific screens.

**Доступность:**
- Видимая кнопка Refresh рядом (не все откроют gesture).
- Haptic feedback (лёгкая вибрация) для подтверждения.
- Voice Control support.

*Источник:* [Pull-to-Refresh Patterns](https://www.bizcatalyst360.com/mastering-pull-to-refresh-design-principles-and-best-practices/)

---

## 4. Доступность и включение

### 4.1 Пожилые пользователи: Dynamic Type, контраст, Voice

**Dynamic Type (iOS/Android):**
- iOS: Settings → Accessibility → Display & Text Size → Large Accessibility Sizes.
- Android: Settings → Display → Font Size или System font scaling (`sp` units).
- Test max size (often 200%+ text).

**Layout при больших шрифтах:**
- Переходи на stacked (вертикальный) layout, не inline.
- Контейнеры должны быть scrollable (иначе content обрезается).
- Достаточная высота touch-target: min 48 dp (Android), 44 pt (iOS).

**WCAG 2.1 Level AA (критично для гос.):**
- Контраст 4.5:1 для нормального текста.
- Контраст 3:1 для крупного текста.
- Возможность увеличить текст на 200%.

**Дополнительные фишки для старшего возраста:**
- VoiceOver (iOS) / TalkBack (Android) support.
- Voice Control.
- Text-to-speech встроенный.
- Ночной режим (Reduce White Point).
- Bigger cursor (iOS 17+).

**Исследование:** даже малые дизайн-изменения сильно улучшают usability старших пользователей; вариант с текстом рядом с иконками — явный выигрыш.

*Источники:* [Elderly-Friendly Design Guide](https://www.digitalpolicy.gov.hk/en/our_work/digital_government/digital_inclusion/accessibility/promulgating_resources/application_design_guide/doc/elderly_friendly_design_guide_eng.pdf), [A11Y Project Text Resizing](https://www.a11yproject.com/posts/text-resizing-in-ios-and-android/)

### 4.2 Низкая грамотность: простой язык, визуал, voice-first

**Plain Language (6-й класс уровень чтения):**
- Короткие предложения: макс 15–20 слов.
- Активный залог: "Отправьте документ" вместо "Документ должен быть отправлен".
- Избегай жаргона, аббревиатур без расшифровки.

**Визуальное усиление:**
- Icons + text (не только icons).
- Простые, узнаваемые иллюстрации.
- Цветовое кодирование (зелёный = ОК, красный = ошибка) + text.
- Культурно-адаптированные образы (критично для низкого SES).

**Voice-First:**
- Text-to-speech для всех инструкций.
- Voice input для заполнения форм.
- Аудио-подсказки вместо только текстовых.

**Исследование:** users с низкой грамотностью предпочитают визуальные элементы, графические controls (big radio buttons), не text-heavy interfaces. Multimedia (видео + audio) значительно повышает comprehension.

*Источники:* [Designing Health Literate Apps](https://odphp.health.gov/sites/default/files/2019-11/BPH-HealthLiterateApps_0.pdf), [Defra Digital Plain Language](https://defradigital.blog.gov.uk/2022/09/21/recognising-the-power-of-literacy-when-designing-services/)

---

## 5. Ограничения рынка Узбекистана

### 5.1 ОС и устройства

**Доля рынка (StatCounter, август 2026):**
- Android: 82.97% (фоны+планшеты)
- iOS: 17.02%

**Версии Android (август 2026, фоны + планшеты):**
| Версия | Доля |
|--------|------|
| Android 13 | 21.87% |
| Android 16 | 16.16% |
| Android 15 | 14.66% |
| Android 12 | 12.63% |
| Android 14 | 10.82% |
| Android 11 | 8.68% |

**Вывод:** минимум поддерживай Android 11 (API 30); большинство пользователей на 12–13, но 8.68% ещё на 11. iOS: особых ограничений нет (iOS 16+ = все фишки).

*Источник:* [StatCounter Uzbekistan](https://gs.statcounter.com/os-market-share/mobile/uzbekistan)

### 5.2 Telegram как основной канал

**Масштаб:**
- 76% интернет-пользователей Узбекистана.
- Министерства, бизнес, образ. учреждения, неформальные сети работают через Telegram.
- Telegram бот или канал — стандарт для гос. учреждений.

**Использование контента:**
- Самый частый источник новостей (51.6%).
- Телевидение (44.6%), Instagram (41.6%).
- Но доверие низкое: Telegram (11.3%) vs Госсайты (17.3%) vs Телевидение (44.3%).

**Вывод для GovBot:** Telegram — один из ключевых каналов для продвижения приложения (уведомления, новости сервисов). Но само приложение должно быть *более* доверенным, чем Telegram-канал (официальная печать, подтверждение источников).

*Источники:* [Telegram 76% Uzbekistan](https://onlytg.io/telegram-news/uzbekistans-digital-growth-telegram-reaches-76-of-internet-users.html), [Telegram Media Consumption](https://www.uzdaily.uz/en/telegram-and-television-lead-media-consumption-in-uzbekistan/)

### 5.3 Платёжные системы

**Лидеры Узбекистана:**
1. **Payme** — Merchant API (JSON-RPC): CheckPerformTransaction, CreateTransaction, PerformTransaction, CancelTransaction.
2. **Click** — Prepare/Complete 2-step; January 2025 — поддержка tokenization (сохранённые карты).
3. **Uzum** — 16M monthly active users; также платёжное средство в e-commerce.
4. **Uzcard/Humo** — локальные карты; часто через QR + мобильный кошелёк.

**Интеграция:**
- Библиотеки: PayTechUZ, UniPay UZ оборачивают все в одну API.
- Webhook-обработчики для Django/FastAPI.
- Требование для Payme: зарегистрированный бизнес (ИП или ООО).

**Вывод:** встроить Payme + Click для тестирования и штрафов; Uzum для будущих товаров/услуг.

*Источники:* [Deep Dive Payments Uzbekistan](https://samboboev.medium.com/deep-dive-payments-in-uzbekistan-f07981902911), [Unipay UZ GitHub](https://github.com/javlondevv/unipay-uz)

### 5.4 OneID и SSO

**OneID** — гос. цифровая идентификация (id.egov.uz):
- Click теперь требует OneID-привязку для платежей.
- Setup: MyGov → Mobile-ID регистрация → SMS код → биометрия лица или OneID-сканер.
- Для веб-сайтов: Flask-библиотеки SSO через `sso.egov.uz`.

**Вывод:** GovBot должен предлагать login через OneID как основной способ; fallback на SMS 2FA для пожилых.

*Источник:* [Click OneID Integration](https://github.com/javlondevv/unipay-uz)

### 5.5 Узбекский язык: латиница vs кириллица

**История:** араб → 1920-е латиница → 1940–1993 кириллица → с 1993 официально латиница.

**Текущая ситуация:**
- Школы, гос. документы: латинский узбекский.
- Поколение 50+: кириллица.
- Интернет, социальные сети: оба скрипта (даже в одном посте).

**Особенности латинского узбекского:**
- `gʻ` и `oʻ` — две буквы с mark U+02BB (ʻ, не обычный апостроф).
- Новая предложенная вариация: "G'" → "Ḡ", "Sh" → "Ş".

**Рекомендация:**
- Основной: латинский узбекский (официальный).
- Добавь кириллический узбекский + русский для старшего возраста и тех, кто читает киррилицу онлайн.
- Используй правильные Unicode: U+02BB для gʻ/oʻ (не обычный апостроф).
- Инструмент: UzTransliterator (Python) для конвертации между 3 скриптами.

*Источники:* [Uzbek Latin vs Cyrillic](https://uzbekistanwanderer.com/uzbek-alphabet-latin-cyrillic/), [UzTransliterator PyPI](https://pypi.org/project/UzTransliterator/), [Banking Apps Language Support](https://4rize.com/en/blog/uzbekistan-banking-and-fintech-apps-multi-languages-support-trends/)

---

## 6. 25+ ранжированных рекомендаций по дизайну

### Приоритет 1: Фундамент (обязательно)

1. **Navigation: 4-вкладка (Bottom Tab Bar)**
   - Home | Chat | Catalog | Profile.
   - Badge-счётчики на неуведомленных пунктах.
   - iOS: .tabViewStyle(.bottomBar) + 44 pt высота; Android: BottomNavigationBar.
   - *Причина:* стандарт для гос. приложений (Диia, my.gov.uz).

2. **OneID / SMS 2FA как основной вход**
   - Кнопка "Вход через OneID" на Splash.
   - Fallback: номер телефона + SMS-код (для пожилых, без биометрии).
   - QR-код OneID для настольных ПК.
   - *Причина:* критичной для доверия; SMS — для инклюзии.

3. **Home Screen: избранные услуги + недавние**
   - Toolbar: Search (поиск услуги).
   - Grid 2×2 избранных сервисов (или виджеты, если user добавил).
   - Section "Недавно используемые" с history.
   - Кнопка "Полный каталог" внизу.
   - *Причина:* снижает трение (не копаться в списке 35 услуг).

4. **Chat Interface: потоковые ответы**
   - Composer закреплён внизу (dock).
   - Лист сообщений с bottom padding = composer height + safe area.
   - Потоковый текст: каждый токен выводится по мере generation.
   - Typing indicator (3 анимированные точки) во время генерации.
   - *Причина:* создаёт ощущение живого диалога (как ChatGPT).

5. **Sources / Citations: встроенные в текст**
   - Перед основным текстом ответа: "Источники: gov.uz/..., lex.uz/...".
   - Или inline: [1] links directly to gov source.
   - *Причина:* доверие; пожилые должны видеть официальные источники.

6. **Offline support: режим "без интернета"**
   - Кэшируй последние 50 Q&A + каталог услуг.
   - Разрешить просмотр cached ответов.
   - Очередь на отправку (Outbox pattern): если пользователь пытается отправить — queue, отправим при reconnect.
   - Visual indicator: "Вы не подключены. Некоторые функции недоступны."
   - *Причина:* Узбекистан — не везде устойчивая сеть; критично для сельской местности.

### Приоритет 2: UX улучшения (+ 2–3 недели)

7. **Dynamic Type support (WCAG)**
   - Min 48 dp tap targets.
   - Max text size test: 200%+ не должно обрезаться.
   - Стек layout при больших шрифтах (вертикальный, не inline).
   - *Причина:* доступность для пожилых (критична для гос.).

8. **Voice control & accessibility**
   - Text-to-speech для всех инструкций.
   - Voice input: хотя бы для поиска.
   - VoiceOver/TalkBack labels на все buttons.
   - *Причина:* низкая грамотность + слепота (редко, но может).

9. **Skeleton screens при загрузке**
   - Load > 500 ms → показать скелет.
   - Shimmer: gradient sweep 1.5–2 сек.
   - Load < 300 ms → ничего не показывай (избегай flash).
   - Prefers-reduced-motion: убрать анимацию, оставить статичный тинт.
   - *Причина:* меньше воспринимаемая задержка.

10. **Bottom Sheet для детальных форм**
    - Detent: `.medium()` (полёт) + `.large()` (full).
    - Close button видна (+ swipe down).
    - iOS: grabber (область захвата) видна.
    - *Причина:* стандартный pattern для модальных в мобилях.

11. **Pull-to-refresh на Home & Chat history**
    - Visible refresh button рядом.
    - Haptic feedback при refresh.
    - *Причина:* ожидание от пользователя; иначе не поймут, как обновить.

12. **Suggested Prompts в Chat**
    - 3–4 часто используемых вопроса на экране Chat (если history пуст).
    - "Как подать заявление на паспорт?", "Статус моей налоговой декларации", "Как заплатить штраф".
    - Tap → вставляет в composer.
    - *Причина:* помогает новичкам; уменьшает барьер входа.

13. **Settings для языка (Uzbek Latin, Uzbek Cyrillic, Russian, English)**
    - Settings → Language.
    - Default: Uzbek Latin (официальный).
    - *Причина:* dual-script population Uzbekistan.

14. **Payme/Click integration для платежей**
    - Кнопка "Оплатить штраф" → opens Payme/Click.
    - Webhook callback → update app после оплаты.
    - *Причина:* гос. платежи требуют этого.

### Приоритет 3: Визуальное совершенство (+ 1–2 недели)

15. **Кирпичный узбекский дизайн: Girih + Samarkand**
    - Основной цвет: #0A6E78 (бирюза) + акценты gold (#D4A574).
    - Background: light #F5F6F8.
    - Girih-star geom patterns в header/footer (но не перегружай).
    - Samarkand arch curve в dividers, иногда.
    - *Причина:* национальная идентичность; выделяется от типовых Material Design.

16. **Spring Animation на основных переходах**
    - Navigation push/pop: damping 1.0, response 0.3–0.4.
    - Fast spatial для quick confirmations (damping 0.6, 800 ms).
    - *Причина:* гладкость, не резкость.

17. **Haptic feedback на важные события**
    - Light impact при submit.
    - Selection feedback (medium) при выборе услуги.
    - *Причина:* тактильное подтверждение; помогает пожилым.

18. **Dark Mode support**
    - OLED экраны стали популярны.
    - Dark mode: чёрный фон (#1A1A1A) + более светлые текст/иконки.
    - Бирюза #0A6E78 → slightly lighter in dark mode.
    - *Причина:* eye comfort, battery life на OLED.

19. **Error States с plain language**
    - НЕ: "Error 0x1AF: Network timeout".
    - ДА: "Проверьте интернет-соединение. Повтор за 5 сек...".
    - Иконка ошибки (красный крест или warning circle).
    - *Причина:* низкая грамотность; error codes бесполезны.

20. **Empty States с guidance**
    - "История чата пуста. Задайте вопрос или выберите тему из предложенных."
    - Иллюстрация (просто, не сложно).
    - Suggested prompts ниже.
    - *Причина:* сбить confusion; направить next action.

### Приоритет 4: Advanced (опционально)

21. **Reminders & Notifications**
    - Напоминание о deadline (Срок подачи паспорта: 3 дня).
    - Push notification в 09:00, если deadline близко.
    - In-app banner + звук/haptic.
    - *Причина:* управление deadlines — критичная фишка гос. услуг.

22. **Conversation list with Search**
    - Side panel (iPad) или bottom sheet (phone).
    - Search by keyword из старых Q&A.
    - Pin favourites (часто задаваемые вопросы).
    - *Причина:* история grows; нужна быстрая навигация.

23. **Attachment upload (photos, docs)**
    - Camera + Photo library.
    - PDF preview (если возможно).
    - Upload progress bar.
    - *Причина:* отправка фото документов — стандартный flow для гос. услуг.

24. **Personalization: My Services shortcuts**
    - Settings → "My Services": выбери свои 3–5 сервисов.
    - Они появятся на Home screen вместо дефолтных.
    - *Причина:* разные люди используют разные услуги; персонализация = retention.

25. **Share feature: результаты ответа, чек-лист**
    - Share ответ в Telegram / WhatsApp / Email.
    - Share completed чек-лист (например, "Документы для паспорта" с галочками).
    - *Причина:* viral distribution; люди должны поделиться результатом.

### Приоритет 5: Polish (+ 1 неделя)

26. **Micro-interactions: loading → success → done**
    - Submit button: rotate spinner → checkmark (2–3 сек hold).
    - Transition smooth (не резкое изменение).
    - *Причина:* feel of responsiveness.

27. **Ночной режим для пожилых (Blue Light filter)**
    - Settings → Display → Night Shift preference.
    - Slightly warmer цвета по умолчанию.
    - *Причина:* eye strain reduction для длительного use.

28. **Cached offline search in Catalog**
    - Local full-text search по названиям услуг.
    - Даже без интернета можно найти нужный сервис.
    - *Причина:* discovery важна; не теряй в offline.

---

## 7. Рекомендация по технологии

### React Native vs Flutter vs Capacitor в 2025–2026

| Критерий | React Native (+ Reanimated 4) | Flutter | Capacitor (Ionic) |
|----------|------------------------------|---------|-------------------|
| **Анимации** | Reanimated 3+ = 60 FPS smooth (off-JS-thread) | Native engine (Impeller) = 120 FPS, лучше на graphics | WebView ceiling; 60 FPS max, может стать bottleneck |
| **Память** | ~50 MB overhead; Worklets Bundle Mode (-100 MB) | ~200 MB типично | ~300 MB (WebView) |
| **Startup** | ~100 ms (cold start) | ~150 ms | 200–500 ms (WebView parse) |
| **Код-шеринг с Vite web** | Partial (React, но не styles/logic часто) | Нет встроенного | Полный (HTML/CSS/JS = web stack) |
| **Скорость dev** | Быстро (hot reload, npm ecosystem) | Быстро (hot reload, pub ecosystem) | Самая быстрая (веб = известно) |
| **Сложные gestures** | Reanimated + Gesture Handler = ok | Отличный native support | Сложно (жесткие браузерные ограничения) |
| **Offline sync** | Good (можно реализовать custom) | Good (native SQLite) | Good (localStorage, но медленнее) |
| **iOS/Android parity** | 95% (minor bugs могут быть) | 99% | 95% (WebView quirks) |

**Вывод для GovBot:**

- **Flutter** выигрывает, если app **очень animation-heavy** и нужна максимальная производительность на бюджетных Android-телефонах (что актуально для Узбекистана с 83% Android 11–13).
- **React Native** выигрывает, если у вас **уже есть React + Vite web app**, можно переиспользовать logic и state management (Redux/Zustand). Reanimated 4 достаточно хорош для большинства apps.
- **Capacitor** выигрывает, если нужна **максимальная скорость dev** и можно пожертвовать performance на high-end animations; хорош для content-driven apps (not interaction-heavy).

**Рекомендация:** **Flutter** для GovBot, потому что:
1. Очень animation-heavy (smooth transitions, spring physics, shimmer).
2. Нужна оптимизация для старых Android (11–13, часто бюджетные Xiaomi/Poco/Redmi).
3. Не нужен код-шеринг с web (дизайн может отличаться).
4. Dart + Flutter ecosystem достаточно зрелый для гос. приложений.

**Альтернатива:** React Native + Reanimated 4 + Expo, если в вашей компании уже React-команда и есть web-app для переиспользования code.

*Источники:* [React Native vs Capacitor 2026](https://www.bacancytechnology.com/blog/react-native-reanimated), [Flutter vs React Native 2026](https://www.agilesoftlabs.com/blog/2026/02/flutter-vs-react-native-2026-cost-dx_17), [Reanimated 3 Performance](https://erenelagz.medium.com/react-native-reanimated-3-the-ultimate-guide-to-high-performance-animations-in-2025-d2d2579e5bf5)

---

## 8. Заключение и следующие шаги

GovBot должен наследовать **лучшее из Диia/Singpass/GOV.UK:** простую 4-вкладочную навигацию, быстрый поиск, недавние действия, встроенные источники. **Узбекистан-специфичное:** поддержка Payme/Click, OneID, dual-language (Latin/Cyrillic Uzbek + Russian), оптимизация для Android 11–13, встроенность в Telegram-экосистему для продвижения.

**Доступность — не опция:** 15–20% пожилых пользователей, low-literacy population → Dynamic Type, Voice, plain language, иконки + текст. Offline mode критичен для сельской местности.

**Дизайн:** национально-узнаваемый (Girih, Samarkand, бирюза #0A6E78), современный, но не перегруженный. Spring animations (damping 1.0, response 0.3–0.4) для smooth transitions.

**Технология:** Flutter для animation performance и Android optimization; React Native + Reanimated 4 если в компании React-специалисты.

**Timeline:** 
- Неделя 1–2: Foundation (Nav, OneID, Chat, Home, Offline).
- Неделя 3: UX polish (Dark Mode, Accessibility, Motion).
- Неделя 4: Advanced (Reminders, Personalization, Share).
- Неделя 5: Testing, QA, Uzbek localization.

---

## Ссылки на источники

- [Diia App Store](https://apps.apple.com/us/app/%D0%B4%D1%96%D1%8F/id1489717872)
- [Singpass Medium](https://medium.com/ndi-sg/not-just-for-logging-in-redesigning-singapores-digital-identity-app-545c08d820bb)
- [GOV.UK App 2025](https://www.publictechnology.net/2025/07/01/society-and-welfare/gov-uk-app-launches-nationwide/)
- [Gosuslugi Habr](https://habr.com/ru/articles/546966/)
- [TAMM Abu Dhabi](https://gulfnews.com/living-in-uae/ask-us/uae-access-over-750-abu-dhabi-government-services-on-one-platform---the-tamm-app-1.1697637964634)
- [Material 3 Motion](https://m3.material.io/)
- [iOS Haptics](https://github.com/emilkowalski/skills/blob/main/skills/apple-design/SKILL.md)
- [Skeleton Screens](https://medium.com/design-bootcamp/the-ultimate-guide-to-skeleton-screens-in-modern-ui-design-4df362615113)
- [StatCounter Uzbekistan](https://gs.statcounter.com/os-market-share/mobile/uzbekistan)
- [Telegram Uzbekistan](https://onlytg.io/telegram-news/uzbekistans-digital-growth-telegram-reaches-76-of-internet-users.html)
- [Payme + Click Integration](https://github.com/javlondevv/unipay-uz)
- [Uzbek Language](https://uzbekistanwanderer.com/uzbek-alphabet-latin-cyrillic/)
- [Flutter vs React Native 2026](https://www.agilesoftlabs.com/blog/2026/02/flutter-vs-react-native-2026-cost-dx_17)
- [Reanimated 4 Performance](https://erenelagz.medium.com/react-native-reanimated-3-the-ultimate-guide-to-high-performance-animations-in-2025-d2d2579e5bf5)
- [Elderly-Friendly Design](https://www.digitalpolicy.gov.hk/en/our_work/digital_government/digital_inclusion/accessibility/promulgating_resources/application_design_guide/doc/elderly_friendly_design_guide_eng.pdf)
- [Plain Language](https://defradigital.blog.gov.uk/2022/09/21/recognising-the-power-of-literacy-when-designing-services/)
- [Offline-First Architecture](https://www.askantech.com/offline-first-mobile-architecture-apps-without-internet/)
