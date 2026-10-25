import { Effect } from "effect";
import type { Locale } from "use-intl";
import { getShellArticleNavigation } from "@/lib/content/article/navigation";
import { getShellPageNavigation } from "@/lib/content/page/navigation";

/** Reads the site shell navigation of one locale: the article categories and the signed pages. */
export const readMarketingShell = Effect.fn("www.marketing.shell.read")(
  function* (locale: Locale) {
    const [articleNavigation, pageNavigation] = yield* Effect.all(
      [getShellArticleNavigation(locale), getShellPageNavigation(locale)],
      { concurrency: "unbounded" }
    );
    return { articleNavigation, pageNavigation };
  }
);
