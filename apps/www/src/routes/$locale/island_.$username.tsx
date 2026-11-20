import { lazy } from "@repo/design-system/lib/lazy";
import {
  createFileRoute,
  getRouteApi,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { Suspense } from "react";
import { RouteConvexProvider } from "@/components/providers/route";
import { privateHead } from "@/lib/account/head";
import { worldScreenFn } from "@/lib/account/island.functions";
import { MessagesProvider } from "@/lib/i18n/provider";
import { readRenderedRouteMessages } from "@/lib/i18n/rendered";

/** The game and its renderer, loaded once the visitor enters (ADR 0047, D1 and D9). */
const IslandGame = lazy(() => import("@/components/island/game"));

const localeRoute = getRouteApi("/$locale");

/**
 * A visit to another learner's world on the whole screen (ADR 0050, W6): the
 * same game, with nothing to build with. It needs no account, renders only in
 * the browser, stays out of search, and sends a learner who opens their own
 * address to their own game.
 */
export const Route = createFileRoute("/$locale/island_/$username")({
  ssr: false,
  gcTime: 0,
  loader: async ({ params }) => {
    const [messages, screen] = await Promise.all([
      readRenderedRouteMessages({
        locale: params.locale,
        namespaces: ["Island"],
      }),
      worldScreenFn({
        data: { locale: params.locale, username: params.username },
      }),
    ]);
    if (screen.own) {
      throw redirect({
        params: { locale: params.locale },
        statusCode: 307,
        to: "/$locale/island",
      });
    }
    return { messages, screen };
  },
  head: ({ loaderData }) =>
    loaderData === undefined ? {} : privateHead(loaderData.screen.seo),
  component: WorldPage,
});

/** Draws the visited world with the game's words joined to the shell's; leaving returns to the page the visitor came from, or home. */
function WorldPage() {
  const { locale } = Route.useParams();
  const { messages, screen } = Route.useLoaderData();
  const { messages: shellMessages } = localeRoute.useLoaderData();
  const router = useRouter();
  return (
    <MessagesProvider
      locale={locale}
      messages={{ ...shellMessages, ...messages }}
    >
      <RouteConvexProvider>
        <Suspense fallback={null}>
          <IslandGame
            blueprints={[]}
            host={{
              level: screen.level,
              name: screen.name,
              username: screen.username,
            }}
            key={screen.owner}
            level={screen.level}
            onLeave={() => {
              if (router.history.canGoBack()) {
                router.history.back();
                return;
              }
              router.navigate({ params: { locale }, to: "/$locale" });
            }}
            owner={screen.owner}
            progress={{ from: 0, lifetime: 0, next: 0 }}
          />
        </Suspense>
      </RouteConvexProvider>
    </MessagesProvider>
  );
}
