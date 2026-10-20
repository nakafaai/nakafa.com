import { DEFAULT_LOCALE } from "@repo/internationalization/src/locale";
import { SITE_ORIGIN } from "@repo/seo/origin";
import {
  createFileRoute,
  type NotFoundRouteProps,
  notFound,
} from "@tanstack/react-router";
import { Option, Schema } from "effect";
import { LocalizedNotFound } from "@/components/state/localized";
import { NotFoundPageData } from "@/lib/routing/not-found";
import { readNotFoundLocaleFn } from "@/lib/routing/not-found.fn";

/**
 * The standalone not-found page. The server renders it in the locale of a refused
 * or missing address, with the request header that names the locale (ADR 0026).
 * The not-found error carries that locale, so the document speaks it too. A school
 * host has no home of its own, so the page links to the main site, and no search
 * engine indexes it.
 */
export const Route = createFileRoute("/_not-found")({
  head: () => ({
    meta: [{ content: "noindex,nofollow", name: "robots" }],
  }),
  loader: async () => {
    throw notFound({ data: { locale: await readNotFoundLocaleFn() } });
  },
  notFoundComponent: StandaloneNotFound,
});

/** Shows the not-found page of the locale that the loader names, with the links of the main site. */
function StandaloneNotFound({ data }: NotFoundRouteProps) {
  const locale = Option.match(
    Schema.decodeUnknownOption(NotFoundPageData)(data),
    {
      onNone: () => DEFAULT_LOCALE,
      onSome: (found) => found.locale,
    }
  );
  return <LocalizedNotFound locale={locale} origin={SITE_ORIGIN} />;
}
