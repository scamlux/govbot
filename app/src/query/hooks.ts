import { useQuery } from "@tanstack/react-query";

import { billingApi, chatApi, configApi, scenariosApi } from "../api/endpoints";
import type { ScenarioFilters } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import type { Lang } from "../config";
import { queryKeys } from "./client";

export const useConfig = () =>
  useQuery({ queryKey: queryKeys.config, queryFn: configApi.get, staleTime: 10 * 60_000 });

export const useCategories = (lang: Lang) =>
  useQuery({ queryKey: queryKeys.categories(lang), queryFn: () => scenariosApi.categories(lang) });

export const useScenarios = (lang: Lang, filters: ScenarioFilters = {}) =>
  useQuery({
    queryKey: queryKeys.scenarios(lang, filters),
    queryFn: () => scenariosApi.list(lang, filters),
  });

export const useScenario = (lang: Lang, slug: string) =>
  useQuery({
    queryKey: queryKeys.scenario(lang, slug),
    queryFn: () => scenariosApi.detail(slug, lang),
    enabled: Boolean(slug),
  });

export function useConversations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.conversations,
    queryFn: chatApi.conversations,
    enabled: Boolean(user),
  });
}

export function useConversation(id: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.conversation(id),
    queryFn: () => chatApi.conversation(id),
    enabled: Boolean(user) && Number.isFinite(id),
  });
}

export const useBillingPlans = (lang: Lang) =>
  useQuery({ queryKey: queryKeys.billingPlans(lang), queryFn: () => billingApi.plans(lang) });

export function useBillingMe() {
  const { user } = useAuth();
  return useQuery({ queryKey: queryKeys.billingMe, queryFn: () => billingApi.me(), enabled: Boolean(user) });
}
