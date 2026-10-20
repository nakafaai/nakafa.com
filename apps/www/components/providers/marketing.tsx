"use client";

import { Effect, Fiber } from "effect";
import { lazy, type ReactNode, Suspense, useEffect, useState } from "react";
import { AnalyticsConsentBootstrap } from "@/components/analytics/consent/bootstrap";
import {
  MarketingConsentControls,
  MarketingConsentEffects,
} from "@/components/analytics/consent/mount";
import { AnalyticsConsentProvider } from "@/components/analytics/consent/provider";
import { AnalyticsUnavailableProvider } from "@/components/analytics/consent/unavailable";
import { AuthSessionContext } from "@/components/auth/session";
import {
  LiveSessionContext,
  useLiveSession,
} from "@/components/providers/live";
import { clientEnv } from "@/env.client";
import { ConvexAuthContext } from "@/lib/auth/convex";
import { createLiveSessionStore, startLiveSession } from "@/lib/auth/live";
import { PageNavigationProvider } from "@/lib/content/page/context";
import type { PageNavigation } from "@/lib/content/page/navigation";

/** The Convex credentials load with the page's client, so a visitor's page never loads them. */
const LiveCredentials = lazy(() =>
  import("@/components/providers/live.client").then((loaded) => ({
    default: loaded.LiveCredentials,
  }))
);

/** Hands the page's client its credentials once the store holds one. */
function MarketingCredentials() {
  const client = useLiveSession((state) => state.client);
  if (client === null) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <LiveCredentials client={client} />
    </Suspense>
  );
}

/**
 * Mounts the one live session of a marketing page. The store is created once and
 * its context value never changes. The page starts the session after hydration,
 * and only a signed-in hint starts it: a visitor's page creates no Convex client,
 * no Better Auth client and no socket. Leaves that need Convex mount their own
 * island around that one client, and render their visitor variant until it exists.
 */
export function MarketingProviders({
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

  return (
    <LiveSessionContext value={store}>
      <AuthSessionContext value={store}>
        <ConvexAuthContext value={store}>
          <MarketingCredentials />
          <PageNavigationProvider navigation={pageNavigation}>
            {pageNavigation ? (
              <AnalyticsConsentProvider
                isPreviewChild={clientEnv.VITE_AKSARA_PREVIEW_CHILD === "true"}
              >
                {children}
                <AnalyticsConsentBootstrap />
                <MarketingConsentControls />
                <MarketingConsentEffects />
              </AnalyticsConsentProvider>
            ) : (
              <AnalyticsUnavailableProvider>
                {children}
              </AnalyticsUnavailableProvider>
            )}
          </PageNavigationProvider>
        </ConvexAuthContext>
      </AuthSessionContext>
    </LiveSessionContext>
  );
}
