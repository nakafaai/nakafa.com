import type { ReactNode } from "react";
import { AnalyticsConsentBootstrap } from "@/components/analytics/consent/bootstrap";
import { AnalyticsConsentControls } from "@/components/analytics/consent/controls";
import { AnalyticsConsentProvider } from "@/components/analytics/consent/provider";
import { AnalyticsUnavailableProvider } from "@/components/analytics/consent/unavailable";
import { ConvexProvider } from "@/components/providers/convex";
import { clientEnv, isAksaraPreviewChild } from "@/env.client";
import { PageNavigationProvider } from "@/lib/content/page/context";
import type { PageNavigation } from "@/lib/content/page/navigation";

/**
 * Mounts the app-wide client runtime providers for the localized app subtree.
 *
 * The Convex, session, and analytics consent providers are mounted once at the
 * shared `(app)` boundary. The nuqs adapter is not: a component that reads
 * query state mounts it where it reads, so a public page never loads nuqs.
 * Every value these providers put in context stays the same after hydration:
 * React client-renders a streamed Suspense boundary that is still pending when
 * an ancestor context changes, so state that resolves in the browser reaches
 * readers through stores instead.
 *
 * @see https://docs.convex.dev/client/nextjs/app-router/server-rendering
 * @see https://labs.convex.dev/better-auth
 */
export function AppProviders({
  children,
  pageNavigation,
}: {
  children: ReactNode;
  pageNavigation: PageNavigation | null;
}) {
  return (
    <ConvexProvider convexUrl={clientEnv.NEXT_PUBLIC_CONVEX_URL}>
      <PageNavigationProvider navigation={pageNavigation}>
        {pageNavigation ? (
          <AnalyticsConsentProvider isPreviewChild={isAksaraPreviewChild}>
            {children}
            <AnalyticsConsentBootstrap />
            <AnalyticsConsentControls />
          </AnalyticsConsentProvider>
        ) : (
          <AnalyticsUnavailableProvider>
            {children}
          </AnalyticsUnavailableProvider>
        )}
      </PageNavigationProvider>
    </ConvexProvider>
  );
}
