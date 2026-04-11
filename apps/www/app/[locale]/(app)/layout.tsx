import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { Suspense } from "react";
import { AppProviders } from "@/components/providers/app";
import { getToken } from "@/lib/auth/server";

/**
 * Binds the validated locale to the shared authenticated app subtree.
 *
 * With Cache Components enabled, runtime request data must sit behind a
 * Suspense boundary. This layout keeps the shared provider tree stable by
 * rendering the app providers immediately, then streams in the authenticated
 * token once it resolves for routes that need SSR-authenticated Convex state.
 *
 * References:
 * - Convex App Router SSR:
 *   https://docs.convex.dev/client/nextjs/app-router/server-rendering
 * - Next.js Cache Components / mixed static-dynamic routes:
 *   @.agents/skills/next-cache-components/SKILL.md
 */
export default async function Layout(props: LayoutProps<"/[locale]">) {
  const { children, params } = props;
  const tokenPromise = getToken();
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <Suspense fallback={<AppProviders>{children}</AppProviders>}>
      <AuthenticatedAppProviders tokenPromise={tokenPromise}>
        {children}
      </AuthenticatedAppProviders>
    </Suspense>
  );
}

/** Resolves the request token before mounting the authenticated app providers. */
async function AuthenticatedAppProviders({
  children,
  tokenPromise,
}: {
  children: React.ReactNode;
  tokenPromise: ReturnType<typeof getToken>;
}) {
  const token = await tokenPromise;

  return <AppProviders initialToken={token}>{children}</AppProviders>;
}
