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
 * The consent account of a page: the page's one Convex client, and only for a
 * signed-in session on a page whose consent is live. A page without a live notice
 * reads no account. `isAwaitingSession` is true while the page's session still
 * loads: the page shows neither the visitor's nor the account's consent until it
 * settles, so a learner never sees the visitor's prompt first.
 */
function useConsentAccount() {
  const isLive = useStore(
    useAnalyticsConsentStore(),
    (state) => state.mode === "live"
  );
  const client = useLiveSession((state) => state.client);
  const sessionId = useLiveSession((state) => state.sessionId);
  const isSessionPending = useLiveSession((state) => state.isPending);
  return {
    client:
      isLive && sessionId !== null ? client : Option.none<ConvexReactClient>(),
    isAwaitingSession: isLive && isSessionPending,
  };
}

/** The prompt on a page: the visitor's, then the signed-in one on the page's client. */
export function PageConsentControls() {
  const { client, isAwaitingSession } = useConsentAccount();
  if (isAwaitingSession) {
    return null;
  }
  if (Option.isNone(client)) {
    return <VisitorConsentControls />;
  }
  return (
    <Suspense fallback={null}>
      <IslandConsentControls client={client.value} />
    </Suspense>
  );
}

/** The privacy item of a footer, which follows the same rule as the prompt. */
export function PageConsentFooterItem() {
  const { client, isAwaitingSession } = useConsentAccount();
  if (isAwaitingSession) {
    return null;
  }
  if (Option.isNone(client)) {
    return <VisitorConsentFooterItem />;
  }
  return (
    <Suspense fallback={null}>
      <IslandConsentFooterItem client={client.value} />
    </Suspense>
  );
}

/**
 * The consent effects of a page, which follow the same rule as the prompt. A
 * signed-in page starts its analytics with its account, so the visitor's effects
 * wait for the session and the client instead of sending a first pageview without them.
 */
export function PageConsentEffects() {
  const { client, isAwaitingSession } = useConsentAccount();
  if (isAwaitingSession) {
    return null;
  }
  if (Option.isSome(client)) {
    return (
      <Suspense fallback={null}>
        <IslandConsentEffects client={client.value} />
      </Suspense>
    );
  }
  return <VisitorConsentEffects />;
}
