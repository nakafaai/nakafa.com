import { Suspense } from "react";
import { AppProviders } from "@/components/providers/app";
import { getToken } from "@/lib/auth/server";

/**
 * Mount the shared authenticated app provider tree for the localized app
 * subtree.
 *
 * The parent `app/[locale]/layout.tsx` already validates the locale, so this
 * segment only needs to mount the shared request-scoped auth provider tree
 * behind a real Suspense boundary.
 *
 * References:
 * - Convex App Router SSR:
 *   https://docs.convex.dev/client/nextjs/app-router/server-rendering
 * - Next.js Cache Components / mixed static-dynamic routes:
 *   @.agents/skills/next-cache-components/SKILL.md
 */
export default function Layout({ children }: LayoutProps<"/[locale]">) {
  return (
    <Suspense fallback={null}>
      <AuthenticatedAppProviders>{children}</AuthenticatedAppProviders>
    </Suspense>
  );
}

/** Resolves the request token before mounting the authenticated app providers. */
async function AuthenticatedAppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await getToken();

  return <AppProviders initialToken={token}>{children}</AppProviders>;
}
