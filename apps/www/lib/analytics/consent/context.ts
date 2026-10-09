"use client";

import { createContext, use } from "react";
import { useAnalyticsConsentModel } from "@/lib/analytics/consent/model";
import type { AnalyticsConsentStore } from "@/lib/analytics/consent/store";

/** The consent controller's value, derived from the model that builds it. */
export type AnalyticsConsentContextValue = ReturnType<
  typeof useAnalyticsConsentModel
>["value"];

/** Carries one provider's consent store, which never changes after mount. */
export const AnalyticsConsentContext =
  createContext<AnalyticsConsentStore | null>(null);

/** Returns the consent store and rejects a missing provider. */
function useAnalyticsConsentStore() {
  const store = use(AnalyticsConsentContext);
  if (!store) {
    throw new Error(
      "useAnalyticsConsent must be used within AnalyticsConsentProvider"
    );
  }
  return store;
}

/**
 * Reads one derived slice of the optional analytics consent controller.
 *
 * The slice is derived in the reading component from the consent store, the
 * session and Convex authentication stores, and the account consent query,
 * so a reader that hydrates late renders the consent state the server did.
 */
export function useAnalyticsConsent<T>(
  selector: (state: AnalyticsConsentContextValue) => T
) {
  return selector(useAnalyticsConsentModel(useAnalyticsConsentStore()).value);
}
