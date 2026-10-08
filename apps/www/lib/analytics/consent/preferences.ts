import {
  type AnalyticsConsentState,
  AnalyticsConsentStateSchema,
} from "@repo/analytics/consent";
import { Schema } from "effect";

const AnalyticsConsentPreferencesSchema = Schema.Struct({
  isOpen: Schema.Boolean,
  statusAtOpen: Schema.Union(
    AnalyticsConsentStateSchema.members.map((state) => state.fields.status)
  ),
});

export type AnalyticsConsentPreferences =
  typeof AnalyticsConsentPreferencesSchema.Type;

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
