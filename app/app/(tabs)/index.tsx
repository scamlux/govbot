import { Link } from "expo-router";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../src/auth/AuthProvider";
import { useLang } from "../../src/i18n/useLang";
import { useCategories, useConfig } from "../../src/query/hooks";
import { Card, T } from "../../src/ui/primitives";
import { QueryState } from "../../src/ui/QueryState";
import { Screen } from "../../src/ui/Screen";

export default function Home() {
  const { t } = useTranslation();
  const lang = useLang();
  const { user } = useAuth();
  const config = useConfig();
  const categories = useCategories(lang);
  const aiNotice = config.data && config.data.ai_mode !== "live"
    ? t(`m.home.aiMode.${config.data.ai_mode}`)
    : null;

  return (
    <Screen>
      <T variant="largeTitle">
        {t("m.home.greeting")}
        {user ? `, ${user.display_name}` : ""}
      </T>
      {aiNotice ? <T muted>{aiNotice}</T> : null}
      <T variant="title2">{t("m.home.popular")}</T>
      <QueryState query={categories}>
        {(items) =>
          items.map((category) => (
            <Link key={category.slug} href={{ pathname: "/catalog", params: { category: category.slug } }}>
              <Card>
                <T variant="headline">
                  {category.icon} {category.name}
                </T>
                <T variant="footnote" muted>
                  {category.scenario_count}
                </T>
              </Card>
            </Link>
          ))
        }
      </QueryState>
    </Screen>
  );
}
