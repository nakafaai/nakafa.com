"use client";

import { lazy, Suspense } from "react";
import {
  VisitorConsentControls,
  VisitorConsentEffects,
  VisitorConsentFooterItem,
} from "@/components/analytics/consent/visitor";
import { useLiveSession } from "@/components/providers/live";
import { useAnalyticsConsentStore } from "@/lib/analytics/consent/context";

/** The signed-in consent parts load with the page's Convex island, so a visitor's page never loads them. */
const IslandConsentControls = lazy(() =>
  import("@/components/analytics/consent/island.client").then((loaded) => ({
    default: loaded.IslandConsentControls,
  }))
);
const IslandConsentFooterItem = lazy(() =>
  import("@/components/analytics/consent/island.client").then((loaded) => ({
    default: loaded.IslandConsentFooterItem,
  }))
);
const IslandConsentEffects = lazy(() =>
  import("@/components/analytics/consent/island.client").then((loaded) => ({
    default: loaded.IslandConsentEffects,
  }))
);

/**
 * The Convex client that the consent account needs: the page's one client, and only
 * for a page whose consent is live. A page without a live notice reads no account.
 */
function useConsentAccountClient() {
  const client = useLiveSession((state) => state.client);
  const isLive = useAnalyticsConsentStore().getState().mode === "live";
  return isLive ? client : null;
}

/** The prompt on a marketing page: the visitor's, then the signed-in one on the page's client. */
export function MarketingConsentControls() {
  const client = useConsentAccountClient();
  if (client === null) {
    return <VisitorConsentControls />;
  }
  return (
    <Suspense fallback={<VisitorConsentControls />}>
      <IslandConsentControls client={client} />
    </Suspense>
  );
}

/** The privacy item of a marketing footer, which follows the same rule as the prompt. */
export function MarketingConsentFooterItem() {
  const client = useConsentAccountClient();
  if (client === null) {
    return <VisitorConsentFooterItem />;
  }
  return (
    <Suspense fallback={<VisitorConsentFooterItem />}>
      <IslandConsentFooterItem client={client} />
    </Suspense>
  );
}

/** The consent effects of a marketing page, which follow the same rule as the prompt. */
export function MarketingConsentEffects() {
  const client = useConsentAccountClient();
  if (client === null) {
    return <VisitorConsentEffects />;
  }
  return (
    <Suspense fallback={<VisitorConsentEffects />}>
      <IslandConsentEffects client={client} />
    </Suspense>
  );
}
