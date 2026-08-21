import { locale as rootLocale } from "next/root-params";
import { AppProviders } from "@/components/providers/app";
import { getShellPageNavigation } from "@/lib/content/page/navigation";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/**
 * Mounts the shared client provider tree for the localized app subtree.
 *
 * Better Auth resolves the browser session inside the Convex auth adapter.
 * Public pages must not wait for a server JWT before their stable content can
 * render. Protected server routes read their own token at the route boundary
 * and preload authenticated Convex state with that exact request credential.
 *
 * References:
 * - Better Auth client provider:
 *   https://labs.convex.dev/better-auth/framework-guides/next#client-provider
 * - Next.js Cache Components / mixed static-dynamic routes:
 *   @.agents/skills/next-cache-components/SKILL.md
 */
export default async function Layout({ children }: LayoutProps<"/[locale]">) {
  const locale = getLocaleOrThrow(await rootLocale());
  const pageNavigation = await getShellPageNavigation(locale);

  return (
    <AppProviders pageNavigation={pageNavigation}>{children}</AppProviders>
  );
}
