import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { ConvexAppProviders } from "@/components/providers";
import { MainShellBoundary } from "@/components/sidebar/main-shell-boundary";
import { getToken } from "@/lib/auth/server";

/**
 * Owns the authenticated Convex boundary for the full `/try-out` namespace.
 *
 * The tryout runtime uses native Convex SSR preloads, so this layout seeds the
 * first Better Auth provider in the subtree with the current request token.
 * Keeping this boundary in a dedicated route group avoids broadening dynamic
 * rendering for static content routes while keeping the tryout tree cohesive.
 *
 * @see https://docs.convex.dev/client/nextjs/app-router/server-rendering
 * @see https://labs.convex.dev/better-auth/migrations/migrate-to-0-10#pass-initial-token-to-convexbetterauthprovider
 */
export default async function Layout(props: LayoutProps<"/[locale]">) {
  const { children, params } = props;
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const token = await getToken();

  return (
    <ConvexAppProviders initialToken={token}>
      <MainShellBoundary>{children}</MainShellBoundary>
    </ConvexAppProviders>
  );
}
