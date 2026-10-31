import { createFileRoute } from "@tanstack/react-router";
import { LocalizedNotFound } from "@/components/state/localized";
import {
  notFoundRouteHead,
  readNotFoundRouteLocale,
} from "@/lib/routing/not-found";

/**
 * The not-found page of one locale for a school host, which the build prerenders and strips of its scripts like the
 * main site's `404.html`. The Worker answers a refused school page with it (ADR 0026): the first HTML holds the
 * page, no Worker renders it, and its home link leads to the main site, because the school's own home is not found too.
 */
export const Route = createFileRoute("/_notfound/school/$locale")({
  loader: ({ params }) => readNotFoundRouteLocale(params.locale),
  head: ({ loaderData }) => notFoundRouteHead(loaderData),
  component: SchoolNotFoundPage,
});

/** Shows the not-found page of the route's locale with its one link, to the main site's home. */
function SchoolNotFoundPage() {
  const locale = Route.useLoaderData();
  return <LocalizedNotFound locale={locale} school />;
}
