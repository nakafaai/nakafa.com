import { lazy } from "@repo/design-system/lib/lazy";
import {
  createFileRoute,
  getRouteApi,
  Navigate,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { Option } from "effect";
import { Suspense } from "react";
import { Unauthenticated } from "@/components/auth/gate";
import { SignedInIsland } from "@/components/providers/island";
import { useLiveSession } from "@/components/providers/live";
import { PageProviders } from "@/components/providers/page";
import { privateHead } from "@/lib/account/head";
import { islandScreenFn } from "@/lib/account/island.functions";
import { resolvePostAuthIntent } from "@/lib/auth/admission";
import { isSignedIn } from "@/lib/auth/gate";
import { MessagesProvider } from "@/lib/i18n/provider";
import { readRenderedRouteMessages } from "@/lib/i18n/rendered";

/** The game and its renderer, loaded once the learner enters (ADR 0047, D1 and D9). */
const IslandGame = lazy(() => import("@/components/island/game"));

const localeRoute = getRouteApi("/$locale");

/**
 * The world game on the whole screen (ADR 0047, D1): no sidebar, header or
 * page frame. Like the account screens it renders only in the browser and
 * sends a visitor without a session to sign-in first, and it stays out of search.
 */
export const Route = createFileRoute("/$locale/island")({
  ssr: false,
  // What a learner earned and opened since an earlier visit is newer than what that visit read, so every entry reads it again.
  gcTime: 0,
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

/**
 * Draws the game with the island's words joined to the shell's; leaving returns
 * to the page the learner came from, or home. The page holds its own live
 * session, since it stands outside the student shell that holds one: the game
 * mounts on the page's Convex client once that session is confirmed, so the
 * stored world is read, and every change is sent, as the learner.
 */
function IslandPage() {
  const { locale } = Route.useParams();
  const { messages, screen } = Route.useLoaderData();
  const { messages: shellMessages } = localeRoute.useLoaderData();
  const router = useRouter();
  return (
    <MessagesProvider
      locale={locale}
      messages={{ ...shellMessages, ...messages }}
    >
      <PageProviders pageNavigation={null}>
        <SessionEnd />
        <SignedInIsland>
          <Suspense fallback={null}>
            <IslandGame
              blueprints={screen.blueprints}
              host={null}
              key={screen.owner}
              level={screen.level}
              onLeave={() => {
                if (router.history.canGoBack()) {
                  router.history.back();
                  return;
                }
                router.navigate({ params: { locale }, to: "/$locale/home" });
              }}
              owner={screen.owner}
              progress={{
                from: screen.from,
                lifetime: screen.lifetime,
                next: screen.next,
              }}
            />
          </Suspense>
        </SignedInIsland>
      </PageProviders>
    </MessagesProvider>
  );
}

/** Sends the learner to sign-in once Convex Auth answers that no session stands under the open game: one that ended in another tab, or a hint that outlived its session. */
function SessionEnd() {
  const { locale } = Route.useParams();
  const started = useLiveSession((state) => Option.isSome(state.client));
  return started ? (
    <Unauthenticated>
      <Navigate params={{ locale }} replace to="/$locale/auth" />
    </Unauthenticated>
  ) : null;
}
