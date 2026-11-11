import { Link, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { TextInput } from "react-native";
import { useTranslation } from "react-i18next";

import { useLang } from "../../src/i18n/useLang";
import { useCategories, useScenarios } from "../../src/query/hooks";
import { useA11y } from "../../src/theme/a11y";
import { Card, T } from "../../src/ui/primitives";
import { QueryState } from "../../src/ui/QueryState";
import { Screen } from "../../src/ui/Screen";

export default function Catalog() {
  const { t } = useTranslation();
  const lang = useLang();
  const { palette } = useA11y();
  const params = useLocalSearchParams<{ category?: string }>();
  const [search, setSearch] = useState("");
  const categories = useCategories(lang);
  const scenarios = useScenarios(lang, { category: params.category, search: search.trim() || undefined });

  return (
    <Screen>
      <T variant="largeTitle">{t("scenarios.title")}</T>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={t("scenarios.searchPlaceholder")}
        placeholderTextColor={palette.muted}
        accessibilityLabel={t("scenarios.searchPlaceholder")}
        style={{ color: palette.ink, backgroundColor: palette.surface, padding: 12, borderRadius: 12 }}
      />
      {categories.data ? (
        <T variant="footnote" muted>
          {categories.data.map((c) => c.name).join(" / ")}
        </T>
      ) : null}
      <QueryState query={scenarios}>
        {(items) =>
          items.length === 0 ? (
            <T muted>{t("scenarios.noResults")}</T>
          ) : (
            items.map((scenario) => (
              <Link key={scenario.slug} href={{ pathname: "/scenario/[slug]", params: { slug: scenario.slug } }}>
                <Card>
                  <T variant="headline">{scenario.title}</T>
                  <T variant="subhead" muted numberOfLines={2}>
                    {scenario.excerpt}
                  </T>
                </Card>
              </Link>
            ))
          )
        }
      </QueryState>
    </Screen>
  );
}
