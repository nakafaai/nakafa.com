"use client";

import { Function as Fn } from "effect";
import {
  createContext,
  type ReactNode,
  use,
  useSyncExternalStore,
} from "react";
import { AnalyticsUnavailableProvider } from "@/components/analytics/consent/unavailable";
import { SignedOutSessionProvider } from "@/components/auth/session";
import { AppProviders } from "@/components/providers/app";
import { hasSignedInHint } from "@/lib/auth/hint";
import { PageNavigationProvider } from "@/lib/content/page/context";
import type { PageNavigation } from "@/lib/content/page/navigation";

const LiveSessionContext = createContext(false);

/**
 * Whether this page runs the live session: the Convex client and Better Auth's
 * session. A visitor's page runs the signed-out session and no Convex client.
 */
export function useLiveSession() {
  return use(LiveSessionContext);
}

/** The cookie does not change while the page is open, so no store notifies its readers. */
function subscribeNothing() {
  return Fn.constVoid;
}

/** The server renders the visitor's page, which the browser keeps unless its hint says otherwise. */
function readServerSignedInHint() {
  return false;
}

/** The browser reads the signed-in hint of its cookies. */
function readBrowserSignedInHint() {
  return hasSignedInHint(document.cookie);
}

/** The visitor's providers: the signed-out session, page navigation and no consent controls. */
function VisitorProviders({
  children,
  pageNavigation,
}: {
  children: ReactNode;
  pageNavigation: PageNavigation | null;
}) {
  return (
    <SignedOutSessionProvider>
      <PageNavigationProvider navigation={pageNavigation}>
        <AnalyticsUnavailableProvider>{children}</AnalyticsUnavailableProvider>
      </PageNavigationProvider>
    </SignedOutSessionProvider>
  );
}

/**
 * Mounts the providers of a marketing page. A visitor without the signed-in hint
 * gets no Convex client, no Better Auth session and no WebSocket. A signed-in
 * account keeps the live app providers.
 */
export function MarketingProviders({
  children,
  pageNavigation,
}: {
  children: ReactNode;
  pageNavigation: PageNavigation | null;
}) {
  const signedIn = useSyncExternalStore(
    subscribeNothing,
    readBrowserSignedInHint,
    readServerSignedInHint
  );

  return (
    <LiveSessionContext value={signedIn}>
      {signedIn ? (
        <AppProviders pageNavigation={pageNavigation}>{children}</AppProviders>
      ) : (
        <VisitorProviders pageNavigation={pageNavigation}>
          {children}
        </VisitorProviders>
      )}
    </LiveSessionContext>
  );
}
