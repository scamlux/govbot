import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import HelpContacts from "../components/HelpContacts";

/**
 * Plain-language summary of what GovBot stores and why. It describes the system as
 * built (see CLAUDE.md §6 for the env flags it mentions).
 *
 * DRAFT — the wording must be reviewed by a lawyer before a public launch (tracked as
 * LEGAL in docs/research/upgrade-plan.md). Kept in English for all languages until the
 * reviewed text is translated, so no unreviewed legal wording ships in three variants.
 */
export default function Privacy() {
  const { t } = useTranslation();
  return (
    <article className="page prose">
      <h1>{t("footer.privacy")}</h1>
      <p><em>Draft — pending legal review.</em></p>

      <h2>What GovBot is</h2>
      <p>{t("footer.about")} {t("trust.disclaimer")}</p>

      <h2>What we store</h2>
      <ul>
        <li>Your account: email, name, preferred language, a hashed password.</li>
        <li>Your conversations with the assistant, so you can reopen them.</li>
        <li>Your 👍 / 👎 ratings and optional comments, to improve answers.</li>
        <li>Guest chat (when enabled) is not stored: the conversation stays in your browser.</li>
      </ul>

      <h2>What leaves the server</h2>
      <p>
        Questions are sent to the AI provider (OpenAI) to generate an answer. Before that,
        GovBot masks passport numbers, PINFL, card numbers, phone numbers and email
        addresses. Please do not type them anyway.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>
          Download everything stored about you, or delete your account and all conversations,
          from your <Link to="/profile">profile</Link>.
        </li>
        <li>Signing out revokes your session on the server.</li>
        <li>Operators may configure automatic deletion of old conversations.</li>
      </ul>

      <h2>{t("help.title")}</h2>
      <HelpContacts />
    </article>
  );
}
