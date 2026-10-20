import type { ConvexReactClient } from "convex/react";
import { Option } from "effect";
import { lazy, Suspense } from "react";
import { useStore } from "zustand";
import {
  VisitorConsentControls,
  VisitorConsentEffects,
  VisitorConsentFooterItem,
} from "@/components/analytics/consent/visitor";
import { useLiveSession } from "@/components/providers/live";
import { useAnalyticsConsentStore } from "@/lib/analytics/consent/context";

/** The signed-in consent parts load with the page's Convex island, so a visitor's page never loads them. */
const IslandConsentControls = lazy(() =>
  import("@/components/analytics/consent/island").then((loaded) => ({
    default: loaded.IslandConsentControls,
  }))
);
const IslandConsentFooterItem = lazy(() =>
  import("@/components/analytics/consent/island").then((loaded) => ({
    default: loaded.IslandConsentFooterItem,
  }))
);
const IslandConsentEffects = lazy(() =>
  import("@/components/analytics/consent/island").then((loaded) => ({
    default: loaded.IslandConsentEffects,
  }))
);

/**
 * The consent account of a marketing page: the page's one Convex client, and only
 * for a page whose consent is live. A page without a live notice reads no account.
 * `isAwaitingClient` is true while a signed-in session is still loading its client.
 */
function useConsentAccount() {
  const isLive = useStore(
    useAnalyticsConsentStore(),
    (state) => state.mode === "live"
  );
  const client = useLiveSession((state) => state.client);
  const isSessionPending = useLiveSession((state) => state.isPending);
  return {
    client: isLive ? client : Option.none<ConvexReactClient>(),
    isAwaitingClient: isLive && Option.isNone(client) && isSessionPending,
  };
}

/** The prompt on a marketing page: the visitor's, then the signed-in one on the page's client. */
export function MarketingConsentControls() {
  const { client } = useConsentAccount();
  if (Option.isNone(client)) {
    return <VisitorConsentControls />;
  }
  return (
    <Suspense fallback={<VisitorConsentControls />}>
      <IslandConsentControls client={client.value} />
    </Suspense>
  );
}

/** The privacy item of a marketing footer, which follows the same rule as the prompt. */
export function MarketingConsentFooterItem() {
  const { client } = useConsentAccount();
  if (Option.isNone(client)) {
    return <VisitorConsentFooterItem />;
  }
  return (
    <Suspense fallback={<VisitorConsentFooterItem />}>
      <IslandConsentFooterItem client={client.value} />
    </Suspense>
  );
}

/**
 * The consent effects of a marketing page, which follow the same rule as the
 * prompt. A signed-in page starts its analytics with its account, so the visitor's
 * effects wait for the client instead of sending a first pageview without it.
 */
export function MarketingConsentEffects() {
  const { client, isAwaitingClient } = useConsentAccount();
  if (Option.isSome(client)) {
    return (
      <Suspense fallback={<VisitorConsentEffects />}>
        <IslandConsentEffects client={client.value} />
      </Suspense>
    );
  }
  if (isAwaitingClient) {
    return null;
  }
  return <VisitorConsentEffects />;
}
