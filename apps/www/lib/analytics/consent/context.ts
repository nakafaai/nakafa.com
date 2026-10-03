"use client";

import type { AnalyticsConsentState } from "@repo/analytics/consent";
import { createContext, use } from "react";
import { useAnalyticsConsentModel } from "@/lib/analytics/consent/model";
import type { AnalyticsConsentPreferences } from "@/lib/analytics/consent/preferences";
import type { AnalyticsConsentStore } from "@/lib/analytics/consent/store";

export type AnalyticsConsentError = "load" | "runtime" | "save";

export interface AnalyticsConsentContextValue {
  readonly canDecline: boolean;
  readonly canGrant: boolean;
  readonly decide: (granted: boolean) => void;
  readonly error: AnalyticsConsentError | null;
  readonly isAvailable: boolean;
  readonly isPromptOpen: boolean;
  readonly isSaving: boolean;
  readonly preferences: AnalyticsConsentPreferences;
  readonly setPreferencesOpen: (open: boolean) => void;
  readonly status: AnalyticsConsentState["status"];
}

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
