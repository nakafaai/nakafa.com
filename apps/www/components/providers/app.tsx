import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { AnalyticsConsentControls } from "@/components/analytics/consent/controls";
import { AnalyticsConsentProvider } from "@/components/analytics/consent/provider";
import { AnalyticsUnavailableProvider } from "@/components/analytics/consent/unavailable";
import { ConvexProvider } from "@/components/providers/convex";
import { ReactQueryProviders } from "@/components/providers/react-query";
import { PageNavigationProvider } from "@/lib/content/page/context";
import type { PageNavigation } from "@/lib/content/page/navigation";
import { UserContextProvider } from "@/lib/context/use-user";

/**
 * Mounts the app-wide client runtime providers for the localized app subtree.
 *
 * `NuqsAdapter` and `ReactQueryProviders` are global router/query config, while
 * the Convex and current-user contexts are seeded once per request at the
 * shared `(app)` boundary.
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
  const content = pageNavigation ? (
    <AnalyticsConsentProvider>
      {children}
      <AnalyticsConsentControls />
    </AnalyticsConsentProvider>
  ) : (
    <AnalyticsUnavailableProvider>{children}</AnalyticsUnavailableProvider>
  );

  return (
    <NuqsAdapter>
      <ReactQueryProviders>
        <ConvexProvider>
          <UserContextProvider>
            <PageNavigationProvider navigation={pageNavigation}>
              {content}
            </PageNavigationProvider>
          </UserContextProvider>
        </ConvexProvider>
      </ReactQueryProviders>
    </NuqsAdapter>
  );
}
