import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AppShell } from "@/components/sidebar/shell";
import { getShellArticleNavigation } from "@/lib/content/article/navigation";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/**
 * Renders the shared student shell for learn pages and core signed-in routes.
 *
 * Keeping one shell instance for both route groups avoids shell-state
 * divergence across cross-group navigations under Cache Components. Pages
 * stream inside the shell, so a page that waits for request data still shows
 * the shell first.
 */
export default async function Layout(props: LayoutProps<"/[locale]">) {
  const { children } = props;
  const locale = getLocaleOrThrow(await rootLocale());
  const articleNavigation = await getShellArticleNavigation(locale);

  return (
    <AppShell articleNavigation={articleNavigation}>
      <Suspense fallback={null}>{children}</Suspense>
    </AppShell>
  );
}
