"use client";

import type { AnalyticsConsentState } from "@repo/analytics/consent";
import { createContext, useContextSelector } from "use-context-selector";
import type { AnalyticsConsentPreferences } from "@/lib/analytics/consent/preferences";

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

export const AnalyticsConsentContext =
  createContext<AnalyticsConsentContextValue | null>(null);
const missingAnalyticsConsentContext = Symbol("AnalyticsConsentContext");

/** Reads one derived slice of the optional analytics consent controller. */
export function useAnalyticsConsent<T>(
  selector: (state: AnalyticsConsentContextValue) => T
) {
  const selected = useContextSelector(AnalyticsConsentContext, (context) =>
    context ? selector(context) : missingAnalyticsConsentContext
  );
  if (selected === missingAnalyticsConsentContext) {
    throw new Error(
      "useAnalyticsConsent must be used within AnalyticsConsentProvider"
    );
  }
  return selected;
}
