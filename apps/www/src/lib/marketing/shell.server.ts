import type { Locale } from "use-intl";
import { getShellArticleNavigation } from "@/lib/content/article/navigation";
import { getShellPageNavigation } from "@/lib/content/page/navigation";

/** Reads the site shell navigation of one locale: the article categories and the signed pages. */
export async function readMarketingShell(locale: Locale) {
  const [articleNavigation, pageNavigation] = await Promise.all([
    getShellArticleNavigation(locale),
    getShellPageNavigation(locale),
  ]);
  return { articleNavigation, pageNavigation };
}
