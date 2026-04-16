import { NuqsAdapter } from "nuqs/adapters/next/app";
import { type ReactNode, Suspense } from "react";
import { ConvexProvider } from "@/components/providers/convex";
import { getToken } from "@/lib/auth/server";
import { UserContextProvider } from "@/lib/context/use-user";

/**
 * Mounts the minimal auth-capable runtime for the standalone `/auth` route.
 *
 * The page intentionally lives outside the shared `(app)` subtree so account
 * changes fully tear down the authenticated Convex provider before the next
 * protected route mounts again.
 *
 * @see apps/www/node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md
 * @see apps/www/node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md
 */
export default function Layout({ children }: LayoutProps<"/[locale]">) {
  return (
    <Suspense fallback={null}>
      <AuthPageProviders>{children}</AuthPageProviders>
    </Suspense>
  );
}

/** Resolves the request token before mounting the auth page client providers. */
async function AuthPageProviders({ children }: { children: ReactNode }) {
  const token = await getToken();

  return (
    <NuqsAdapter>
      <ConvexProvider initialToken={token}>
        <UserContextProvider>{children}</UserContextProvider>
      </ConvexProvider>
    </NuqsAdapter>
  );
}
