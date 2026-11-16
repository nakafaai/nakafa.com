import { Effect, Option } from "effect";
import { readLocaleCountry } from "@/components/tryout/catalog/options";
import { readPublishedTryoutHubPage } from "@/lib/content/tryout/catalog";
import { temporaryRedirect } from "@/lib/routing/public/redirect";
import {
  decodeAppLocale,
  readPathSegments,
  TRYOUT_ROOT,
} from "@/lib/routing/public/tryout/route";

/**
 * Answers the address of "Try out", which is no page of its own, with a
 * temporary redirect to one country's page: the locale's own country, else the
 * catalog's first. Indonesia and Germany never share a page. A learner's last
 * choice reaches them through the sidebar's own link instead.
 */
export const readHubRedirect = Effect.fn("www.routing.publicHtml.tryoutHub")(
  function* (pathname: string) {
    const [localeSegment, root, ...rest] = readPathSegments(pathname);
    const appLocale = decodeAppLocale(localeSegment);
    if (Option.isNone(appLocale) || root !== TRYOUT_ROOT || rest.length > 0) {
      return null;
    }
    const hub = yield* readPublishedTryoutHubPage({
      appLocale: appLocale.value,
    });
    return Option.match(readLocaleCountry(appLocale.value, hub.countries), {
      onNone: () => null,
      onSome: (country) =>
        temporaryRedirect(`/${appLocale.value}/${country.publicPath}`),
    });
  }
);
