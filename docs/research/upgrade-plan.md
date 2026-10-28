# GovBot: план апгрейдов (чек-лист)

Источник пунктов: `2026-10-27-features.md` (A–F) и `2026-10-27-redesign.md` (R1–R7).
Статусы: ✅ сделано · ⛔ заблокировано (внешний блокер назван) · ⏭️ пропущено (причина).
Обновлено: 2026-10-28.

Правила, которые действовали для всех пунктов:
- Миграции только аддитивные (`scenarios/0004` + стандартные `token_blacklist`): новые поля nullable или с default.
- Всё, что открывает неавторизованный доступ или тратит деньги (гостевой чат, Telegram), включается флагом в env и по умолчанию выключено.
- Данные не выдумываются: пошлины, сроки и URL услуг вносит только редактор из официальных источников. Сделаны структура и UI.
- Перед пушем: backend pytest, `makemigrations --check`, frontend `npm test` и `npm run build`.

**Проверка на 2026-10-28:** backend 235 тестов ✅ (было 157), frontend 35 тестов ✅ (было 18), `vite build` ✅, миграции не нужны ✅. Ручная проверка в браузере (Playwright, 1440px и 320px, uz): главная, роли, гостевой чат, онбординг, карточка сценария, админка. Скриншоты: `docs/screenshots/after/`.
Коммиты в `main`: backend `dbdf8a1`, frontend + docs `3fb1964`.

**Прод после пуша (2026-10-28):** Vercel обновился сразу (`/widget.js` 200; `/embed` отдаёт `frame-ancestors *`, остальные страницы `frame-ancestors 'self'` + `SAMEORIGIN`). Render обновился за 165 с: `/api/config/` → `{"guest_chat":false,"chat_mode":"ai","ai_mode":"live","telegram_bot":false}`; миграция `0004` применена (у сценариев есть `verified_at`, `checklist`, `audience`); `?audience=tourist` → 8 тем; гостевой стрим и Telegram webhook → 404 (флаги выключены); `auth/logout/` без токена → 400.

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
| A3 | `verified_at` + канонический `source_url` (структура) | ✅ | поле + бейдж «Проверено / Ещё не проверено» + редактор в админке. Канонические URL услуг вносит редактор (контент не выдуман) |
| A4 | Eval-harness ретривала | ✅ | `manage.py eval_retrieval`, golden set 29 вопросов; keyword recall@3 55% → 86% после стемминга |
| A5 | Уточняющие вопросы (промпт) | ✅ | `CLARIFY_INSTRUCTION`; `test_plain_language_instruction_in_payload` |
| A7 | Автоопределение языка вопроса | ✅ | `chat/safety.detect_language`; 11 тестов; в UI «Javob tili: English» |
| A8 | Кластеризация пробелов каталога | ✅ | `cluster_questions` (косинус эмбеддингов или Jaccard стемов); варианты в админке |
| B1 | Гостевой чат с лимитом по IP (флаг) | ✅ | `/api/chat/guest/stream/`, `GUEST_CHAT_ENABLED=0` по умолчанию; проверено в браузере |
| B3 | Онбординг по роли | ✅ | `?audience=`, выбор роли на главной; сиды размечены по аудитории |
| B4 | Озвучка ответов (TTS) | ✅ | `hooks/useSpeechOutput.js`; кнопка только если есть голос для языка |
| B6 | Лёгкий режим (Save-Data) | ✅ | `data-lite` в `main.jsx` + стили |
| C1 | Структурированный чек-лист документов | ✅ | поле `checklist` + UI + редактор. Списки пустые до заполнения редактором — данные не выдумывались |
| C2 | Трекер прогресса | ✅ | галочки чек-листа сохраняются локально, счётчик «Готово N из M» |
| C4 | Напоминание в календарь | ✅ | `.ics` на дату, выбранную пользователем; тест `buildIcs` |
| C6 | Hand-off «ответ не помог» | ✅ | контакты появляются после 👎; тест |
| E1 | Статусы черновик / на проверке / опубликовано | ✅ | `Scenario.status` + синхронизация с `is_published`; селектор в админке. Отдельная роль «редактор» не заводилась: сейчас есть только staff |
| E2 | История версий и откат | ✅ | `ScenarioRevision`, `/revisions/`, `/restore/`; откат сам обратим |
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
| F1 | httpOnly refresh-cookie | ⛔ | Фронт на vercel.app и бэк на onrender.com — разные сайты; cross-site cookie режутся Safari/Chrome. Нужно решение владельца: общий домен или прокси `/api` через Vercel |
| C3 | Калькулятор пошлин | ⏭️ | Нет надёжного источника актуальных сумм |
| C5 | Карта и часы ЦГУ | ⏭️ | Открытого источника данных не найдено |
| D3 | WhatsApp | ⏭️ | Спрос не подтверждён, нужен платный Business API |
| R7b | Перевод uz-строк на новый алфавит | ⛔ | Закон о реформе алфавита не подписан |
| LEGAL | Дисклеймер, `/privacy`, политика ПДн | ⛔ | Черновики в продукте (`/privacy` помечена Draft); нужна проверка юристом |
| E6 | Отчёт по пробелам с префиллом | ✅ | Было в коде до апгрейда |
