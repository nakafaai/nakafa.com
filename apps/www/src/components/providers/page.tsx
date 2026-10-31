import { Effect, Fiber, Option } from "effect";
import { lazy, type ReactNode, Suspense, useEffect, useState } from "react";
import {
  PageConsentControls,
  PageConsentEffects,
} from "@/components/analytics/consent/mount";
import { AnalyticsConsentProvider } from "@/components/analytics/consent/provider";
import { AnalyticsUnavailableProvider } from "@/components/analytics/consent/unavailable";
import { AuthSessionContext } from "@/components/auth/context";
import { useSignedInHint } from "@/components/auth/session";
import {
  LiveSessionContext,
  useLiveSession,
} from "@/components/providers/live";
import { clientEnv } from "@/env.public";
import { ConvexAuthContext } from "@/lib/auth/convex";
import { createLiveSessionStore, startLiveSession } from "@/lib/auth/live";
import { PageNavigationProvider } from "@/lib/content/page/context";
import type { PageNavigation } from "@/lib/content/page/navigation";

/** The Convex credentials load with the page's client, so a visitor's page never loads them. */
const LiveCredentials = lazy(() =>
  import("@/components/providers/credentials").then((loaded) => ({
    default: loaded.LiveCredentials,
  }))
);

/** The release of those credentials, from the same module. */
const LiveRelease = lazy(() =>
  import("@/components/providers/credentials").then((loaded) => ({
    default: loaded.LiveRelease,
  }))
);

/** Hands the page's client its credentials once the store holds one. */
function PageCredentials() {
  const client = useLiveSession((state) => state.client);
  if (Option.isNone(client)) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <LiveCredentials client={client.value} />
    </Suspense>
  );
}

/**
 * Clears the page client's credentials when the route group goes. It renders
 * after every reader of the page, so their queries are released first: a query
 * still subscribed when the credentials go runs once more without them, and
 * the server refuses it with SessionRequired.
 */
function PageRelease() {
  const client = useLiveSession((state) => state.client);
  if (Option.isNone(client)) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <LiveRelease client={client.value} />
    </Suspense>
  );
}

/**
 * Mounts the one live session of a route group that visitors and learners both
 * read: the marketing pages and the student shell. The store is created once and
 * its context value never changes. The page starts the session after hydration,
 * and only a signed-in hint starts it: a visitor's page creates no Convex client,
 * no Better Auth client and no socket. Leaves that need Convex mount their own
 * island around that one client (see `ConvexIsland`), and render their visitor
 * variant until it exists.
 */
export function PageProviders({
  children,
  pageNavigation,
}: {
  children: ReactNode;
  pageNavigation: PageNavigation | null;
}) {
  const [store] = useState(() => createLiveSessionStore());

  useEffect(() => {
    const starting = Effect.runFork(
      startLiveSession(store, {
        convexUrl: clientEnv.VITE_CONVEX_URL,
        cookie: document.cookie,
      })
    );
    return () => {
      Effect.runFork(Fiber.interrupt(starting));
    };
  }, [store]);
  useSignedInHint(store);

  return (
    <LiveSessionContext value={store}>
      <AuthSessionContext value={store}>
        <ConvexAuthContext value={store}>
          <PageCredentials />
          <PageNavigationProvider navigation={pageNavigation}>
            {pageNavigation ? (
              <AnalyticsConsentProvider
                isPreviewChild={clientEnv.VITE_AKSARA_PREVIEW_CHILD === "true"}
              >
                {children}
                <PageConsentControls />
                <PageConsentEffects />
              </AnalyticsConsentProvider>
            ) : (
              <AnalyticsUnavailableProvider>
                {children}
              </AnalyticsUnavailableProvider>
            )}
          </PageNavigationProvider>
          <PageRelease />
        </ConvexAuthContext>
      </AuthSessionContext>
    </LiveSessionContext>
  );
}
