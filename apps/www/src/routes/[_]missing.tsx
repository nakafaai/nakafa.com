import { DEFAULT_LOCALE } from "@repo/internationalization/src/locale";
import {
  createFileRoute,
  type NotFoundRouteProps,
  notFound,
} from "@tanstack/react-router";
import { Option, Schema } from "effect";
import { LocalizedNotFound } from "@/components/state/localized";
import { NotFoundPageData } from "@/lib/routing/not-found";
import { readNotFoundPageFn } from "@/lib/routing/not-found.functions";

/**
 * The standalone not-found page. The server renders it in the locale of a refused
 * or missing address, with the request header that names the locale (ADR 0026).
 * The not-found error carries that locale, so the document speaks it too, and
 * whether the request came to a school host, whose page links home to the main
 * site. No search engine indexes it.
 */
export const Route = createFileRoute("/_missing")({
  loader: async () => {
    throw notFound({ data: await readNotFoundPageFn() });
  },
  head: () => ({
    meta: [{ content: "noindex,nofollow", name: "robots" }],
  }),
  notFoundComponent: StandaloneNotFound,
});

/** Shows the not-found page of the locale and the host that the loader names. */
function StandaloneNotFound({ data }: NotFoundRouteProps) {
  const page = Option.getOrElse(
    Schema.decodeUnknownOption(NotFoundPageData)(data),
    () => ({ locale: DEFAULT_LOCALE, school: false })
  );
  return <LocalizedNotFound locale={page.locale} school={page.school} />;
}
