import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { AnalyticsConsentControls } from "@/components/analytics/consent/controls";
import { AnalyticsConsentProvider } from "@/components/analytics/consent/provider";
import { AnalyticsUnavailableProvider } from "@/components/analytics/consent/unavailable";
import { ConvexProvider } from "@/components/providers/convex";
import { ReactQueryProviders } from "@/components/providers/query";
import { env } from "@/env";
import { PageNavigationProvider } from "@/lib/content/page/context";
import type { PageNavigation } from "@/lib/content/page/navigation";

/**
 * Mounts the app-wide client runtime providers for the localized app subtree.
 *
 * `NuqsAdapter` and `ReactQueryProviders` are global router/query config, and
 * the Convex, session, and analytics consent providers are mounted once at the
 * shared `(app)` boundary. Every value these providers put in context stays
 * the same after hydration: React client-renders a streamed Suspense boundary
 * that is still pending when an ancestor context changes, so state that
 * resolves in the browser reaches readers through stores instead.
 *
 * @see https://github.com/47ng/nuqs#readme
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
    <NuqsAdapter>
      <ReactQueryProviders>
        <ConvexProvider convexUrl={env.NEXT_PUBLIC_CONVEX_URL}>
          <PageNavigationProvider navigation={pageNavigation}>
            {pageNavigation ? (
              <AnalyticsConsentProvider
                isPreviewChild={env.NEXT_PUBLIC_AKSARA_PREVIEW_CHILD === "true"}
              >
                {children}
                <AnalyticsConsentControls />
              </AnalyticsConsentProvider>
            ) : (
              <AnalyticsUnavailableProvider>
                {children}
              </AnalyticsUnavailableProvider>
            )}
          </PageNavigationProvider>
        </ConvexProvider>
      </ReactQueryProviders>
    </NuqsAdapter>
  );
}
