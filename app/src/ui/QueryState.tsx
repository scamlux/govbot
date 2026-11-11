import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";

import { Button, T } from "./primitives";

/** Loading / error / content switch shared by data screens. */
export function QueryState<D>({
  query,
  children,
}: {
  query: UseQueryResult<D>;
  children: (data: D) => ReactNode;
}) {
  const { t } = useTranslation();
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.isError) {
    return (
      <>
        <T muted>{t("m.common.error")}</T>
        <Button tone="plain" label={t("m.common.retry")} onPress={() => void query.refetch()} />
      </>
    );
  }
  return <ActivityIndicator accessibilityLabel={t("m.common.loading")} />;
}
