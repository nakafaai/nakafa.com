"use client";

import type { ReactNode } from "react";
import {
  AnalyticsConsentContext,
  type AnalyticsConsentContextValue,
} from "@/lib/analytics/consent/context";

function ignoreUnavailableConsentAction() {
  // Optional analytics cannot accept a decision before its signed notice is live.
}

const unavailableAnalyticsConsent = {
  canDecline: false,
  canGrant: false,
  decide: ignoreUnavailableConsentAction,
  error: null,
  isAvailable: false,
  isPreferencesOpen: false,
  isPromptOpen: false,
  isSaving: false,
  setPreferencesOpen: ignoreUnavailableConsentAction,
  status: "pending",
} satisfies AnalyticsConsentContextValue;

/** Keeps optional analytics unavailable until its signed privacy notice is live. */
export function AnalyticsUnavailableProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AnalyticsConsentContext.Provider value={unavailableAnalyticsConsent}>
      {children}
    </AnalyticsConsentContext.Provider>
  );
}
