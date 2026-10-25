import { QueryResult } from "@confect/react";
import billingRefs from "@repo/backend/confect/_generated/refs/billing";
import { useConvexAuth } from "@/components/auth/convex";
import { UserSettingsCredits } from "@/components/user/settings/credits";
import { UserSettingsPlan } from "@/components/user/settings/plan";
import { useBillingNavigation } from "@/lib/billing/checkout";
import type { BillingOverview } from "@/lib/billing/plan";
import { usePreloadedQueryResult } from "@/lib/data/preloaded";

/**
 * The billing settings: the plan card and the Nina credits card. The settings
 * route resolves the overview first, so both cards show it before the live query
 * answers, and no action swaps between two labels.
 */
export function UserSettingsSubscriptions({
  initialOverview,
}: {
  initialOverview: BillingOverview;
}) {
  const billing = useBillingNavigation();
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const live = usePreloadedQueryResult(
    billingRefs.queries.overview,
    isAuthenticated ? {} : "skip",
    initialOverview
  );
  if (QueryResult.isFailure(live)) {
    throw live.error;
  }
  const overview = QueryResult.isSuccess(live) ? live.value : initialOverview;

  return (
    <>
      <UserSettingsPlan billing={billing} overview={overview} />
      <UserSettingsCredits overview={overview} />
    </>
  );
}
