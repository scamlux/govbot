import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import { scenariosApi } from "../api/endpoints";
import type { ScenarioDetail } from "../api/types";
import { daysUntil } from "../domain/dates";
import { useLang } from "../i18n/useLang";
import { checklistKey, useChecklist } from "../state/checklist";
import { useReminders, type Reminder } from "../state/reminders";
import { queryKeys } from "./client";

export interface CaseItem {
  slug: string;
  title: string;
  category: string;
  done: number;
  total: number;
  nextItem: string | null;
  /** Days until the earliest upcoming reminder, null when none. */
  daysLeft: number | null;
}

const PREFIX = "checklist:";

/** Slugs with any ticked item or a pending reminder. */
export function activeSlugs(progress: Record<string, readonly string[]>, reminders: readonly Reminder[]): string[] {
  const fromChecklist = Object.entries(progress)
    .filter(([key, ticked]) => key.startsWith(PREFIX) && ticked.length > 0)
    .map(([key]) => key.slice(PREFIX.length));
  const fromReminders = reminders.map((r) => r.slug);
  return [...new Set([...fromChecklist, ...fromReminders])];
}

/** Derive a case row from scenario detail + local progress. Pure, unit-tested. */
export function buildCase(detail: ScenarioDetail, progress: Record<string, readonly string[]>, reminders: readonly Reminder[], now = new Date()): CaseItem {
  const ticked = progress[checklistKey(detail.slug)] ?? [];
  const done = detail.checklist.filter((item) => ticked.includes(item)).length;
  const next = detail.checklist.find((item) => !ticked.includes(item)) ?? null;
  const upcoming = reminders.filter((r) => r.slug === detail.slug && new Date(r.fireAt) > now).sort((a, b) => a.fireAt.localeCompare(b.fireAt))[0];
  return {
    slug: detail.slug,
    title: detail.title,
    category: detail.category.slug,
    done,
    total: detail.checklist.length,
    nextItem: next,
    daysLeft: upcoming ? Math.max(0, daysUntil(new Date(upcoming.fireAt), now)) : null,
  };
}

/** Active cases (checklist started / reminder set), resolved through the (cached) scenario API. */
export function useActiveCases(): { items: CaseItem[]; loading: boolean; refetch: () => Promise<unknown> } {
  const lang = useLang();
  const progress = useChecklist((s) => s.progress);
  const reminders = useReminders((s) => s.reminders);
  const slugs = useMemo(() => activeSlugs(progress, reminders), [progress, reminders]);
  const results = useQueries({
    queries: slugs.map((slug) => ({
      queryKey: queryKeys.scenario(lang, slug),
      queryFn: () => scenariosApi.detail(slug, lang),
      staleTime: 5 * 60_000,
    })),
  });
  const items = useMemo(
    () =>
      results
        .map((r) => r.data)
        .filter((d): d is ScenarioDetail => d !== undefined)
        .map((d) => buildCase(d, progress, reminders)),
    [results, progress, reminders],
  );
  return {
    items,
    loading: results.some((r) => r.isLoading),
    refetch: () => Promise.all(results.map((r) => r.refetch())),
  };
}
