import { locale as rootLocale } from "next/root-params";
import { AppShell } from "@/components/sidebar/shell";
import { getShellArticleNavigation } from "@/lib/content/article/navigation";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/**
 * Keeps one app shell mounted for the catalog, every set, and every section, so
 * moving between them never replaces or hides it. A running attempt locks this
 * same shell instead of mounting a second one.
 *
 * Pages render inside the shell without a streaming boundary of their own. A
 * page that waits for the learner's attempt therefore first paints together
 * with the shell, already locked or unlocked for that attempt, while a client
 * navigation keeps the previous page until the next one is ready.
 */
export default async function Layout({
  children,
}: LayoutProps<"/[locale]/try-out">) {
  const locale = getLocaleOrThrow(await rootLocale());
  const articleNavigation = await getShellArticleNavigation(locale);

  return <AppShell articleNavigation={articleNavigation}>{children}</AppShell>;
}
