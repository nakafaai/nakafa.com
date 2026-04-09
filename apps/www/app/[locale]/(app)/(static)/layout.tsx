import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { ConvexAppProviders } from "@/components/providers";

/**
 * Mounts the non-seeded Convex subtree for routes that can stay statically
 * rendered.
 *
 * Static pages still benefit from the ambient user context after hydration, but
 * avoid request-time token reads at the layout boundary.
 *
 * @see https://nextjs.org/docs/app/guides/streaming
 * @see https://labs.convex.dev/better-auth/migrations/migrate-to-0-10#pass-initial-token-to-convexbetterauthprovider
 */
export default async function Layout(props: LayoutProps<"/[locale]">) {
  const { children, params } = props;
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return <ConvexAppProviders>{children}</ConvexAppProviders>;
}
