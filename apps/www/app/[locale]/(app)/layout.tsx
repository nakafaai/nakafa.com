import { Suspense } from "react";
import { AppProviders } from "@/components/providers/app";
import { getToken } from "@/lib/auth/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/**
 * Binds the validated locale to the shared authenticated app subtree.
 *
 * Every route in the `(app)` group relies on the shared authenticated runtime,
 * so this layout resolves the Better Auth token once and mounts a single
 * provider tree behind a real Suspense boundary. The public `/auth` page lives
 * outside this subtree so account switches fully remount the auth provider
 * instead of preserving stale authenticated client state through navigation.
 *
 * References:
 * - Convex App Router SSR:
 *   https://docs.convex.dev/client/nextjs/app-router/server-rendering
 * - Next.js Cache Components / mixed static-dynamic routes:
 *   @.agents/skills/next-cache-components/SKILL.md
 */
export default async function Layout(props: LayoutProps<"/[locale]">) {
  const { children, params } = props;
  getLocaleOrThrow((await params).locale);

  return (
    <Suspense fallback={<div className="min-h-svh bg-background" />}>
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
