import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { Suspense } from "react";
import { AppProviders } from "@/components/providers/app";
import { getToken } from "@/lib/auth/server";

/**
 * Binds the validated locale to the shared authenticated app subtree.
 *
 * Every route in the `(app)` group relies on `useUser()` through the shared app
 * shell, so this layout resolves the Better Auth token once and mounts a single
 * provider tree behind a real Suspense boundary. The fallback stays intentionally
 * small so we do not duplicate the full app subtree while the request token
 * resolves.
 *
 * References:
 * - Convex App Router SSR:
 *   https://docs.convex.dev/client/nextjs/app-router/server-rendering
 * - Next.js Cache Components / mixed static-dynamic routes:
 *   @.agents/skills/next-cache-components/SKILL.md
 */
export default async function Layout(props: LayoutProps<"/[locale]">) {
  const { children, params } = props;
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

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
