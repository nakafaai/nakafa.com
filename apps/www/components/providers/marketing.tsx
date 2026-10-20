"use client";

import { createContext, type ReactNode, use, useState } from "react";
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

/**
 * Reads the signed-in hint of the browser. The server renders a page as a
 * visitor's page, and the browser of a signed-in account chooses the live
 * session before its first render, so the hydrated tree matches the server's
 * markup: providers render no markup of their own.
 */
function readBrowserSignedInHint() {
  if (typeof document === "undefined") {
    return false;
  }
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
  const [signedIn] = useState(readBrowserSignedInHint);

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
