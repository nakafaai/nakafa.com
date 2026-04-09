import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ComponentProps, ReactNode } from "react";
import { AiContextProvider } from "@/lib/context/use-ai";
import { ContentViewsProvider } from "@/lib/context/use-content-views";
import { PagefindProvider } from "@/lib/context/use-pagefind";
import { SearchContextProvider } from "@/lib/context/use-search";
import { UserContextProvider } from "@/lib/context/use-user";
import { ConvexProvider } from "./convex";
import { ReactQueryProviders } from "./react-query";

/**
 * Mounts request-agnostic client providers at the root layout.
 *
 * This layer stays free of request-time auth so static routes, including the
 * contents subtree, keep their existing prerendering behavior.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/layout
 * @see https://nextjs.org/docs/app/guides/streaming
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SearchContextProvider>
      <NuqsAdapter>
        <ReactQueryProviders>
          <PagefindProvider>
            <ContentViewsProvider>
              <AiContextProvider>{children}</AiContextProvider>
            </ContentViewsProvider>
          </PagefindProvider>
        </ReactQueryProviders>
      </NuqsAdapter>
    </SearchContextProvider>
  );
}

/**
 * Mounts the authenticated Convex and current-user contexts for one route
 * subtree.
 *
 * Keeping this boundary route-scoped lets us seed auth only where SSR preloads
 * need it, without broadening dynamic rendering for static layouts.
 *
 * @see https://docs.convex.dev/client/nextjs/app-router/server-rendering
 * @see https://labs.convex.dev/better-auth/migrations/migrate-to-0-10#pass-initial-token-to-convexbetterauthprovider
 */
export function ConvexAppProviders({
  children,
  initialToken,
}: {
  children: ReactNode;
  initialToken?: ComponentProps<typeof ConvexProvider>["initialToken"];
}) {
  return (
    <ConvexProvider initialToken={initialToken}>
      <UserContextProvider>{children}</UserContextProvider>
    </ConvexProvider>
  );
}
