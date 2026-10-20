"use client";

import { QueryResult, useMutation, useQuery } from "@confect/react";
import { ANALYTICS_CONSENT_CATEGORY } from "@repo/analytics/consent";
import consents from "@repo/backend/confect/_generated/refs/consents";
import { useConvexAuth } from "@/components/providers/convex";
import {
  type AnalyticsConsentContextValue,
  useAnalyticsConsentStore,
} from "@/lib/analytics/consent/context";
import {
  type AnalyticsConsentAccount,
  type AnalyticsConsentModel,
  useAnalyticsConsentModel,
} from "@/lib/analytics/consent/model";
import type { AnalyticsConsentStore } from "@/lib/analytics/consent/store";
import { useViewer } from "@/lib/identity/client";

/** Names the account's consent query for the model: its decision, its failure, or nothing yet. */
function readAccountQuery(
  query: ReturnType<typeof useQuery<typeof consents.current.get>>
): AnalyticsConsentAccount["accountQuery"] {
  if (QueryResult.isSuccess(query)) {
    return { decision: query.value.decision, status: "success" };
  }
  if (QueryResult.isFailure(query)) {
    return { status: "failure" };
  }
  return { status: "pending" };
}

/**
 * Reads the signed-in account's consent facts with Convex hooks. Only a page with
 * a Convex client calls it, so a visitor's page never reads the account.
 */
export function useAnalyticsConsentAccount(
  store: AnalyticsConsentStore
): AnalyticsConsentAccount {
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const isAuthLoading = useConvexAuth((auth) => auth.isLoading);
  const identity = useViewer((state) => state);
  const user = identity.account;
  const setAccountConsent = useMutation(consents.current.set);
  const shouldLoadAccountConsent =
    store.getState().mode === "live" &&
    isAuthenticated &&
    !isAuthLoading &&
    !!user;
  const accountConsentQuery = useQuery(
    consents.current.get,
    shouldLoadAccountConsent ? { category: ANALYTICS_CONSENT_CATEGORY } : "skip"
  );
  const accountQuery = readAccountQuery(accountConsentQuery);

  return {
    accountQuery,
    isAuthLoading,
    isAuthenticated,
    isUserPending: identity.isPending,
    setAccountConsent,
    user,
  };
}

/**
 * Derives the consent model of a signed-in page: the store plus the account's
 * Convex facts. It belongs to the account path only.
 */
export function useAccountConsentModel(): AnalyticsConsentModel {
  const store = useAnalyticsConsentStore();
  return useAnalyticsConsentModel(store, useAnalyticsConsentAccount(store));
}

/** Selects one part of a signed-in page's consent state, derived from its account. */
export function useAnalyticsConsent<T>(
  selector: (state: AnalyticsConsentContextValue) => T
) {
  return selector(useAccountConsentModel().value);
}
