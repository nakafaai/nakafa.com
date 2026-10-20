import { AnalyticsConsentControls } from "@/components/analytics/consent/controls";
import { AnalyticsConsentFooterItem } from "@/components/analytics/consent/footer";
import { AnalyticsConsentEffects } from "@/components/analytics/consent/provider";
import { useVisitorAnalyticsConsentModel } from "@/lib/analytics/consent/context";

/** The prompt of a visitor's page: the anonymous consent state, with no account and no Convex hook. */
export function VisitorConsentControls() {
  const { value } = useVisitorAnalyticsConsentModel();
  return <AnalyticsConsentControls consent={value} />;
}

/** The privacy item of a visitor's footer. */
export function VisitorConsentFooterItem() {
  const { value } = useVisitorAnalyticsConsentModel();
  return <AnalyticsConsentFooterItem consent={value} />;
}

/** The effects of a visitor's page: the anonymous browser consent and the analytics it allows. */
export function VisitorConsentEffects() {
  return (
    <AnalyticsConsentEffects consent={useVisitorAnalyticsConsentModel()} />
  );
}
