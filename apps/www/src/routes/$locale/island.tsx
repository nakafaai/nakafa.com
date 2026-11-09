import { lazy } from "@repo/design-system/lib/lazy";
import {
  createFileRoute,
  getRouteApi,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { Suspense } from "react";
import { IntlProvider } from "use-intl";
import { RouteConvexProvider } from "@/components/providers/route";
import { privateHead } from "@/lib/account/head";
import { islandScreenFn } from "@/lib/account/island.functions";
import { resolvePostAuthIntent } from "@/lib/auth/admission";
import { isSignedIn } from "@/lib/auth/gate";
import { readRenderedRouteMessages } from "@/lib/i18n/rendered";

/** The game and its renderer, loaded once the learner enters (ADR 0047, D1 and D9). */
const IslandGame = lazy(() => import("@/components/island/game"));

const localeRoute = getRouteApi("/$locale");

/**
 * The island game on the whole screen (ADR 0047, D1): no sidebar, header or
 * page frame. Like the account screens it renders only in the browser and
 * sends a visitor without a session to sign-in first, and it stays out of search.
 */
export const Route = createFileRoute("/$locale/island")({
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
      islandScreenFn({ data: { locale: params.locale } }),
    ]);
    return { messages, screen };
  },
  head: ({ loaderData }) =>
    loaderData === undefined ? {} : privateHead(loaderData.screen.seo),
  component: IslandPage,
});

/** Draws the game with the island's words joined to the shell's; leaving returns to the page the learner came from, or home. */
function IslandPage() {
  const { locale } = Route.useParams();
  const { messages, screen } = Route.useLoaderData();
  const { messages: shellMessages } = localeRoute.useLoaderData();
  const router = useRouter();
  return (
    <IntlProvider locale={locale} messages={{ ...shellMessages, ...messages }}>
      <RouteConvexProvider>
        <Suspense fallback={null}>
          <IslandGame
            address={screen.address}
            badges={screen.badges}
            edits={screen.edits}
            level={screen.level}
            onLeave={() => {
              if (router.history.canGoBack()) {
                router.history.back();
                return;
              }
              router.navigate({ params: { locale }, to: "/$locale/home" });
            }}
            progress={{
              from: screen.from,
              lifetime: screen.lifetime,
              ...(screen.next === undefined ? {} : { next: screen.next }),
            }}
            seed={screen.seed}
            shared={screen.shared}
            size={screen.size}
            version={screen.version}
          />
        </Suspense>
      </RouteConvexProvider>
    </IntlProvider>
  );
}
