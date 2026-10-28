# GovBot: план апгрейдов (чек-лист)

Источник пунктов: `2026-10-27-features.md` (A–F) и `2026-10-27-redesign.md` (R1–R7).
Статусы: ✅ сделано · ⛔ заблокировано (внешний блокер назван) · ⏭️ пропущено (причина).
Обновлено: 2026-10-28.

Правила, которые действовали для всех пунктов:
- Миграции только аддитивные (`scenarios/0004` + стандартные `token_blacklist`): новые поля nullable или с default.
- Всё, что открывает неавторизованный доступ или тратит деньги (гостевой чат, Telegram), включается флагом в env и по умолчанию выключено.
- Данные не выдумываются: пошлины, сроки и URL услуг вносит только редактор из официальных источников. Сделаны структура и UI.
- Перед пушем: backend pytest, `makemigrations --check`, frontend `npm test` и `npm run build`.

**Проверка на 2026-10-28:** backend 262 теста ✅ (было 157), frontend 44 теста ✅ (было 18), `vite build` ✅, миграции не нужны ✅. Ручная проверка в браузере (Playwright, 1440px и 320px, uz): главная, роли, гостевой чат, онбординг, карточка сценария, админка. Скриншоты: `docs/screenshots/after/`.
Коммиты в `main`: backend `dbdf8a1`, frontend + docs `3fb1964`.

**Прод после пуша (2026-10-28):** Vercel обновился сразу (`/widget.js` 200; `/embed` отдаёт `frame-ancestors *`, остальные страницы `frame-ancestors 'self'` + `SAMEORIGIN`). Render обновился за 165 с: `/api/config/` → `{"guest_chat":false,"chat_mode":"ai","ai_mode":"live","telegram_bot":false}`; миграция `0004` применена (у сценариев есть `verified_at`, `checklist`, `audience`); `?audience=tourist` → 8 тем; гостевой стрим и Telegram webhook → 404 (флаги выключены); `auth/logout/` без токена → 400.

**Прод 2026-10-28 (вторая волна):**
- F1: register → cookie `govbot_refresh` выставлена (Secure), refresh 200, logout 205, повтор старой cookie 401, удаление аккаунта 204; `/api` отдаёт `x-vercel-cache: MISS`; SSE идёт по частям через прокси. На превью найдены два бага: `/api/:path*` не матчил URL со слэшем на конце (исправлено регуляркой) и Vercel по умолчанию кэшировал внешние rewrite (кэш выключен: `x-vercel-enable-rewrite-caching: 0`, `Cache-Control: no-store`).
- Лимиты: общий `DatabaseCache` (`createcachetable` в entrypoint) — работают между воркерами gunicorn и после рестартов. `NUM_PROXIES` не задан (опционально, не измерялся).
- Контент: `apply_content_updates` — 26 URL и 7 чек-листов; без надёжной официальной страницы не тронуты: emergency-medical, pay-traffic-fines, newborn-health, lost-passport, newborn-registration, deregistration, business-license, vat-registration, residence-permit.
- **Блокер:** чат на проде не отвечает — на аккаунте OpenAI нет кредитов (`insufficient_quota` в логах Render 2026-10-28). Владельцу нужно пополнить баланс на platform.openai.com (billing).

## Волна 1 — доверие и доступность

| ID | Пункт | Статус | Доказательство |
|---|---|---|---|
| A1 | Дисклеймер у поля ввода + онбординг из 3 шагов | ✅ | `components/AiNotice.jsx`; тест `upgrades.test.jsx › AiNotice`; скрин `02-onboarding.png` |
| A2 | Ярлыки происхождения источника + `source_url` на странице сценария | ✅ | `MessageBubble.jsx` (`source-chip-origin`), `ScenarioDetail.jsx`; скрин `03-guest-chat.png`, `04-scenario.png` |
| A6 | Явное «не знаю» при отсутствии заземления | ✅ | `UNGROUNDED_INSTRUCTION` в `chat/services.py` + заметка в UI; `test_build_payload_without_match_has_no_grounding` |
| E5 | Kill-switch `CHAT_MODE=catalog_only` | ✅ | `tests/test_chat_modes.py` (LLM не вызывается) |
| B2 | Офлайн-каталог при API на другом origin | ✅ | `public/sw.js` v2: кэш `/api/scenarios` на любом origin без Authorization |
| F2 | Серверный logout (blacklist) | ✅ | `POST /api/auth/logout/`; `tests/test_account_privacy.py`; гонка вкладок обработана в `api/client.js` |
| F3 | Самоудаление аккаунта и экспорт данных | ✅ | `/api/auth/me/delete/`, `/api/auth/me/export/`, раздел в профиле; запрет удалить последнего админа |
| R1/B5 | A11y: контраст, фокус, skip-link, role=log, focus-trap, цели нажатия, reduced-motion | ✅ | `styles/upgrades.css`; контраст по формуле WCAG: 24 проверки, 0 провалов (старые muted 4.03, green 3.49, rose 3.67, amber 3.34 — исправлены); Modal-тесты; SMIL-спиннер паузится. axe-core в браузере не запускался — внедрение скрипта было запрещено политикой |
| R2 | Футер с «Помощью» (WCAG 3.2.6) | ✅ | `components/Footer.jsx`, `HelpContacts.jsx` (112/1173/1242 сверены с my.gov.uz/ru/for-foreigners 2026-10-28) |

## Волна 2 — качество ответов, охват, контент-структура

| ID | Пункт | Статус | Доказательство |
|---|---|---|---|
| A3 | `verified_at` + канонический `source_url` (структура) | ✅ | поле + бейдж «Проверено / Ещё не проверено» + редактор в админке. Официальные `source_url` для 26 сценариев внесены командой `apply_content_updates` (идемпотентно, при каждом деплое; перед записью создаёт ревизию, правки редакторов не трогает); `verified_at` пуст до проверки владельцем (`docs/research/content-review-2026-10.md`) Дефект сида исправлен (`8bb4290`): сид создаёт только отсутствующие карточки и заполняет пустые поля (`--reset` — для локальной разработки). |
| A4 | Eval-harness ретривала | ✅ | `manage.py eval_retrieval`, golden set 29 вопросов; keyword recall@3 55% → 86% после стемминга |
| A5 | Уточняющие вопросы (промпт) | ✅ | `CLARIFY_INSTRUCTION`; `test_plain_language_instruction_in_payload` |
| A7 | Автоопределение языка вопроса | ✅ | `chat/safety.detect_language`; 11 тестов; в UI «Javob tili: English» |
| A8 | Кластеризация пробелов каталога | ✅ | `cluster_questions` (косинус эмбеддингов или Jaccard стемов); варианты в админке |
| B1 | Гостевой чат с лимитом по IP (флаг) | ✅ | `/api/chat/guest/stream/`, `GUEST_CHAT_ENABLED=0` по умолчанию; проверено в браузере. Остаётся ВЫКЛЮЧЕННЫМ по решению владельца (в плане на потом); лимиты 3/мин и 10/сут на IP + общий потолок 300/сут на всех гостей (`GUEST_THROTTLE_GLOBAL`) |
| B3 | Онбординг по роли | ✅ | `?audience=`, выбор роли на главной; сиды размечены по аудитории |
| B4 | Озвучка ответов (TTS) | ✅ | `hooks/useSpeechOutput.js`; кнопка только если есть голос для языка |
| B6 | Лёгкий режим (Save-Data) | ✅ | `data-lite` в `main.jsx` + стили |
| C1 | Структурированный чек-лист документов | ✅ | поле `checklist` + UI + редактор. Чек-листы для 7 сценариев (register-llc, e-signature-business, tax-declaration, itpark-tax-benefits, tourist-visa, evisa-extension, work-permit) внесены `apply_content_updates`; остальные пусты — данные не выдумывались |
| C2 | Трекер прогресса | ✅ | галочки чек-листа сохраняются локально, счётчик «Готово N из M» |
| C4 | Напоминание в календарь | ✅ | `.ics` на дату, выбранную пользователем; тест `buildIcs` |
| C6 | Hand-off «ответ не помог» | ✅ | контакты появляются после 👎; тест |
| E1 | Статусы черновик / на проверке / опубликовано | ✅ | `Scenario.status` + синхронизация с `is_published`; селектор в админке. Отдельная роль «редактор» не заводилась: сейчас есть только staff Дефект сида исправлен (`8bb4290`): сид создаёт только отсутствующие карточки и заполняет пустые поля (`--reset` — для локальной разработки). |
| E2 | История версий и откат | ✅ | `ScenarioRevision`, `/revisions/`, `/restore/`; откат сам обратим Дефект сида исправлен (`8bb4290`): сид создаёт только отсутствующие карточки и заполняет пустые поля (`--reset` — для локальной разработки). |
| E3 | Вкладка «База знаний» в админке | ✅ | `/api/admin/kb/sources/` + вкладка; ссылка, текст, файл |
| E4 | Устаревшие сценарии + проверка ссылок | ✅ | `/api/admin/scenarios/stale/`, обзор в админке, `manage.py check_scenario_links` |
| R3 | Новая главная | ✅ | поиск, роли, ситуации, гостевой CTA; скрин `01-landing.png` |
| R4 | Крошки, мета, скелетоны, Cmd+K, апострофы | ✅ | `CommandPalette.jsx`, `ScenarioDetail.jsx`, `ScenarioCatalog.jsx`; поиск по `Oʻzbekiston` находит `O'zbekiston` (тест) |
| R5 | «Остановить ответ», XL-шрифт, простой язык | ✅ | AbortController; `data-font="xl"`; `plain: true` в API |
| R6 | Админка: боковая навигация, обзор, ConfirmDialog | ✅ | все `window.confirm` заменены; скрин `05-admin-overview.png` |

## Волна 3 — каналы и безопасность

| ID | Пункт | Статус | Доказательство / блокер |
|---|---|---|---|
| D1 | Telegram-бот | ✅ код · ⛔ запуск | Webhook, секрет, лимит, тесты с моком Telegram API. Живая проверка заблокирована: нужен токен бота от @BotFather и регистрация webhook (владелец) |
| D2 | Встраиваемый виджет | ✅ | `public/widget.js` + страница `/embed` (iframe с нашего домена, CORS для чужих сайтов не нужен). Виджет всегда гостевой, язык из `data-lang`. Встраивание разрешено только для `/embed` (`frame-ancestors` в `vercel.json`), остальные страницы `SAMEORIGIN`. Проверено на стороннем origin: скрин `07-widget.png`. Без `GUEST_CHAT_ENABLED` показывает ссылку на сайт |
| F4 | Политика хранения + purge | ✅ | `purge_conversations`, `CONVERSATION_RETENTION_DAYS`, `ADMIN_CAN_READ_CONVERSATIONS`. Конкретный срок хранения — решение владельца/юриста |
| F5 | Маскирование ПДн перед OpenAI | ✅ | `chat/safety.mask_pii`; 8 тестов |
| F6 | Защита от prompt-injection + red-team | ✅ | `sanitize_reference` + единый блок `<reference>`; 10 тестов |
| R7 | Шрифтовой запас для ʻ | ✅ | Noto Sans subset из 4 глифов в `index.html` + `--font-sans` |

## Заблокировано или пропущено

| ID | Пункт | Статус | Причина |
|---|---|---|---|
| OPS | Прод-бэкенд Render | ✅ | 2026-10-28 `/api/health/` отвечает 200 за 0,4 с |
| F1 | httpOnly refresh-cookie | ✅ | Сделано через same-origin прокси: Vercel rewrite `/api/(.*)` → Render, cookie `govbot_refresh` (HttpOnly, Secure, SameSite=Lax, Path=/api/auth/), access-токен только в памяти. Проверено на проде 2026-10-28 (см. «Прод 2026-10-28 (вторая волна)») |
| C3 | Калькулятор пошлин | ⏭️ | Нет надёжного источника актуальных сумм |
| C5 | Карта и часы ЦГУ | ⏭️ | Открытого источника данных не найдено |
| D3 | WhatsApp | ⏭️ | Спрос не подтверждён, нужен платный Business API |
| R7b | Перевод uz-строк на новый алфавит | ⛔ | Закон о реформе алфавита не подписан |
| LEGAL | Дисклеймер, `/privacy`, политика ПДн | ⛔ | Черновики в продукте (`/privacy` помечена Draft); нужна проверка юристом |
| E6 | Отчёт по пробелам с префиллом | ✅ | Было в коде до апгрейда |
