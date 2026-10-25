import { decodeLocale } from "@repo/internationalization/src/locale";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import { LocalizedNotFound } from "@/components/state/localized";
import { readStandaloneMessages } from "@/lib/i18n/standalone";

/**
 * The not-found page of one locale as a page of its own, which the build prerenders into that locale's `404.html`.
 * Cloudflare answers a missing address with the nearest `404.html` and a 404 status, so a missing address shows the
 * app's own not-found page, in the language of its path, without a Worker call. The build strips the app's scripts
 * from that file, so the page never starts the router on an address that it does not own. A locale the app does not
 * have is missing too.
 */
export const Route = createFileRoute("/_notfound/$locale")({
  loader: ({ params }) =>
    Option.match(decodeLocale(params.locale), {
      onNone: () => {
        throw notFound();
      },
      onSome: (locale) => locale,
    }),
  head: ({ loaderData }) => ({
    meta: [
      { content: "noindex,nofollow", name: "robots" },
      ...(loaderData === undefined
        ? []
        : [{ title: readStandaloneMessages(loaderData).NotFound.title }]),
    ],
  }),
  component: LocaleNotFoundPage,
});

/** Shows the not-found page of the route's locale, with its links to the home page and the search. */
function LocaleNotFoundPage() {
  const locale = Route.useLoaderData();
  return <LocalizedNotFound locale={locale} />;
}
