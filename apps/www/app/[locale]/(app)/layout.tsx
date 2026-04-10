import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { Suspense } from "react";
import { AppProviders } from "@/components/providers/app";
import { getToken } from "@/lib/auth/server";

/**
 * Binds the validated locale to the shared authenticated app subtree.
 *
 * With Cache Components enabled, static and dynamic content can coexist in the
 * same route tree. Seeding the Better Auth token once at the shared `(app)`
 * boundary keeps the outer route structure simple while preserving authenticated
 * Convex SSR where it is needed.
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
    <Suspense fallback={null}>
      <AuthLayout>{children}</AuthLayout>
    </Suspense>
  );
}

/** Seeds the shared app runtime subtree with the current request token. */
async function AuthLayout({ children }: { children: React.ReactNode }) {
  const token = await getToken();

  return <AppProviders initialToken={token}>{children}</AppProviders>;
}
