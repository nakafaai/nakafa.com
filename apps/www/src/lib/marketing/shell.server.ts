import { Effect } from "effect";
import type { Locale } from "use-intl";
import { readTryoutHubRoute } from "@/components/tryout/route/catalog.server";
import { getShellArticleNavigation } from "@/lib/content/article/navigation";
import { getShellPageNavigation } from "@/lib/content/page/navigation";

/**
 * Reads the site shell navigation of one locale: the article categories, the
 * signed pages, and the try-out entry, the public path of the country that
 * "Try out" opens, or null when the locale has no try-outs.
 */
export const readMarketingShell = Effect.fn("www.marketing.shell.read")(
  function* (locale: Locale) {
    const [articleNavigation, pageNavigation, tryout] = yield* Effect.all(
      [
        getShellArticleNavigation(locale),
        getShellPageNavigation(locale),
        readTryoutHubRoute(locale),
      ],
      { concurrency: "unbounded" }
    );
    return {
      articleNavigation,
      pageNavigation,
      tryoutEntry: tryout.kind === "entry" ? tryout.entryPath : null,
    };
  }
);
