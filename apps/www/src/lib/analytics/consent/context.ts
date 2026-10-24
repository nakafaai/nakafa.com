import { createContext, use } from "react";
import {
  type AnalyticsConsentModel,
  useAnalyticsConsentModel,
  visitorAnalyticsConsentAccount,
} from "@/lib/analytics/consent/model";
import type { AnalyticsConsentStore } from "@/lib/analytics/consent/store";

/** The consent controller's value, derived from the model that builds it. */
export type AnalyticsConsentContextValue = AnalyticsConsentModel["value"];

/** Carries one provider's consent store, which never changes after mount. */
export const AnalyticsConsentContext =
  createContext<AnalyticsConsentStore | null>(null);

/** Returns the consent store and rejects a missing provider. */
export function useAnalyticsConsentStore() {
  const store = use(AnalyticsConsentContext);
  if (!store) {
    throw new Error(
      "useAnalyticsConsent must be used within AnalyticsConsentProvider"
    );
  }
  return store;
}

/**
 * Derives the consent model of a visitor's page from the store alone. No Convex
 * hook runs, so a visitor's page loads no Convex client and opens no socket.
 */
export function useVisitorAnalyticsConsentModel(): AnalyticsConsentModel {
  return useAnalyticsConsentModel(
    useAnalyticsConsentStore(),
    visitorAnalyticsConsentAccount
  );
}
