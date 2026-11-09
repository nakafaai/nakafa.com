import { lazy } from "@repo/design-system/lib/lazy";
import { createFileRoute, getRouteApi, redirect } from "@tanstack/react-router";
import { Suspense } from "react";
import { IntlProvider } from "use-intl";
import { privateHead } from "@/lib/account/head";
import { visitScreenFn } from "@/lib/account/visit.functions";
import { resolvePostAuthIntent } from "@/lib/auth/admission";
import { isSignedIn } from "@/lib/auth/gate";
import { readRenderedRouteMessages } from "@/lib/i18n/rendered";

/** The visit and its renderer, loaded once the visitor arrives (ADR 0047, D18 and D9). */
const IslandVisit = lazy(() => import("@/components/island/visit"));

const localeRoute = getRouteApi("/$locale");

/**
 * Another learner's island on the whole screen (ADR 0047, D18), when its owner
 * shared it. Like the game it renders only in the browser, sends a visitor
 * without a session to sign-in first, and stays out of search.
 */
export const Route = createFileRoute("/$locale/island/$username")({
  ssr: false,
  beforeLoad: async ({ location, params }) => {
    if (!(await isSignedIn())) {
      const resolution = resolvePostAuthIntent(location.href, params.locale);
      throw redirect({
        params: { locale: params.locale },
        statusCode: 307,
        to: "/$locale/auth",
        ...(resolution.kind === "none"
          ? {}
          : { search: { redirect: resolution.intent } }),
      });
    }
  },
  loader: async ({ params }) => {
    const [messages, screen] = await Promise.all([
      readRenderedRouteMessages({
        locale: params.locale,
        namespaces: ["Island"],
      }),
      visitScreenFn({
        data: { locale: params.locale, username: params.username },
      }),
    ]);
    return { messages, screen };
  },
  head: ({ loaderData }) =>
    loaderData === undefined ? {} : privateHead(loaderData.screen.seo),
  component: VisitPage,
});

/** Draws the visit with the island's words joined to the shell's. */
function VisitPage() {
  const { locale } = Route.useParams();
  const { messages, screen } = Route.useLoaderData();
  const { messages: shellMessages } = localeRoute.useLoaderData();
  return (
    <IntlProvider locale={locale} messages={{ ...shellMessages, ...messages }}>
      <Suspense fallback={null}>
        <IslandVisit island={screen.island} username={screen.username} />
      </Suspense>
    </IntlProvider>
  );
}
