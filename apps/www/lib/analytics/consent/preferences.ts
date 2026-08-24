import type { AnalyticsConsentState } from "@repo/analytics/consent";

export interface AnalyticsConsentPreferences {
  readonly isOpen: boolean;
  readonly statusAtOpen: AnalyticsConsentState["status"];
}

export const initialConsentPreferences: AnalyticsConsentPreferences = {
  isOpen: false,
  statusAtOpen: "pending",
};

/** Keeps dialog copy stable for the complete open and close animation. */
export function updateConsentPreferences({
  current,
  isOpen,
  status,
}: {
  readonly current: AnalyticsConsentPreferences;
  readonly isOpen: boolean;
  readonly status: AnalyticsConsentState["status"];
}): AnalyticsConsentPreferences {
  if (current.isOpen === isOpen) {
    return current;
  }

  return {
    isOpen,
    statusAtOpen: isOpen ? status : current.statusAtOpen,
  };
}
