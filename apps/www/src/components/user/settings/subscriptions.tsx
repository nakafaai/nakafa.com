import { QueryResult } from "@confect/react";
import billingRefs from "@repo/backend/confect/_generated/refs/billing";
import { useConvexAuth } from "@/components/auth/convex";
import { UserSettingsCredits } from "@/components/user/settings/credits";
import { UserSettingsPayments } from "@/components/user/settings/payments";
import { UserSettingsPlan } from "@/components/user/settings/plan";
import type { BillingOverview } from "@/lib/billing/plan";
import { usePreloadedQueryResult } from "@/lib/data/preloaded";

/**
 * The billing settings: the plan card, the Nina credits card, and the receipts.
 * The settings route resolves the overview first, so both cards show it before
 * the live query answers, and no action swaps between two labels. The receipts
 * follow once their own read arrives.
 */
export function UserSettingsSubscriptions({
  initialOverview,
}: {
  initialOverview: BillingOverview;
}) {
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
      <UserSettingsPlan overview={overview} />
      <UserSettingsCredits overview={overview} />
      <UserSettingsPayments />
    </>
  );
}
