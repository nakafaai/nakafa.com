"use client";

import { AnalyticsConsentControls } from "@/components/analytics/consent/controls";
import { AnalyticsConsentFooterItem } from "@/components/analytics/consent/footer";
import { AnalyticsConsentEffects } from "@/components/analytics/consent/provider";
import { useAccountConsentModel } from "@/lib/analytics/consent/facts";

/**
 * The signed-in prompt. It reads the account's Convex facts, so it mounts under
 * the page's Convex island, or under the app's own provider.
 */
export function AccountConsentControls() {
  const { value } = useAccountConsentModel();
  return <AnalyticsConsentControls consent={value} />;
}

/** The privacy item of a signed-in footer, derived from the account's facts. */
export function AccountConsentFooterItem() {
  const { value } = useAccountConsentModel();
  return <AnalyticsConsentFooterItem consent={value} />;
}

/** The effects of a signed-in page: the account's consent, aligned with the analytics it allows. */
export function AccountConsentEffects() {
  return <AnalyticsConsentEffects consent={useAccountConsentModel()} />;
}
