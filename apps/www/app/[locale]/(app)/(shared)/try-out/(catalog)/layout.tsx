import { locale as rootLocale } from "next/root-params";
import { AppShell } from "@/components/sidebar/app-shell";
import { getShellArticleNavigation } from "@/lib/content/article/navigation";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/** Renders the discovery shell without an attempt subscription. */
export default async function Layout({
  children,
}: LayoutProps<"/[locale]/try-out">) {
  const locale = getLocaleOrThrow(await rootLocale());
  const articleNavigation = await getShellArticleNavigation(locale);

  return <AppShell articleNavigation={articleNavigation}>{children}</AppShell>;
}
