import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ComponentProps, ReactNode } from "react";
import { UserContextProvider } from "@/lib/context/use-user";
import { ConvexProvider } from "./convex";
import { ReactQueryProviders } from "./react-query";

/**
 * Mounts the app-wide client runtime providers for the localized app subtree.
 *
 * `NuqsAdapter` and `ReactQueryProviders` are global router/query config, while
 * the Convex and current-user contexts are seeded once per request at the
 * shared `(app)` boundary.
 *
 * @see https://github.com/47ng/nuqs#readme
 * @see https://docs.convex.dev/client/nextjs/app-router/server-rendering
 * @see https://labs.convex.dev/better-auth/migrations/migrate-to-0-10#pass-initial-token-to-convexbetterauthprovider
 */
export function AppProviders({
  children,
  initialToken,
}: {
  children: ReactNode;
  initialToken?: ComponentProps<typeof ConvexProvider>["initialToken"];
}) {
  return (
    <NuqsAdapter>
      <ReactQueryProviders>
        <ConvexProvider initialToken={initialToken}>
          <UserContextProvider>{children}</UserContextProvider>
        </ConvexProvider>
      </ReactQueryProviders>
    </NuqsAdapter>
  );
}
