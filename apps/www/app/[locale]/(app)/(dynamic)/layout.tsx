import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { ConvexAppProviders } from "@/components/providers";
import { getToken } from "@/lib/auth/server";

/**
 * Mounts the auth-seeded Convex subtree for request-time application routes.
 *
 * Dynamic pages use authenticated SSR preloads and live Convex subscriptions,
 * so this boundary seeds the first Better Auth provider in the subtree with the
 * current request token.
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
    <ConvexAppProviders initialToken={token}>{children}</ConvexAppProviders>
  );
}
