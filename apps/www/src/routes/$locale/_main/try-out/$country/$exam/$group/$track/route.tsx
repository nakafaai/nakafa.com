import { localeTimeZone } from "@repo/internationalization/src/locale";
import {
  createFileRoute,
  getRouteApi,
  notFound,
  Outlet,
  stripSearchParams,
  useMatch,
} from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { Page } from "@/components/shared/page/frame";
import {
  CATALOG_QUERY_DEFAULTS,
  CatalogQuery,
  catalogLoaderDeps,
} from "@/components/tryout/catalog/table/query";
import { TryoutSetTable } from "@/components/tryout/catalog/table/sets";
import { TryoutTrailHeader } from "@/components/tryout/catalog/trail";
import { readTryoutTrackFn } from "@/components/tryout/route/catalog.functions";
import { opensSetPaper } from "@/components/tryout/route/search";
import { hasSignedInHint } from "@/lib/auth/hint";
import { readRouteMessages } from "@/lib/i18n/messages.functions";
import { MessagesProvider } from "@/lib/i18n/provider";
import { readStaticData } from "@/lib/static/data";

/**
 * The messages the track's pages read that the student shell does not carry: Island, for the learner's level,
 * medals and leaderboard in the set's pane (ADR 0047, D27).
 */
const TRACK_NAMESPACES = ["Island"] as const;

const localeRoute = getRouteApi("/$locale");
const mainRoute = getRouteApi("/$locale/_main");

/**
 * The catalog query that a loader reads. A learner's table reads its own selection
 * live (`useTryoutSetData`), so their move between filters reads the answer the
 * build kept and asks no Worker.
 */
const readLoaderQuery = createIsomorphicFn()
  .server((query: CatalogQuery) => query)
  .client((query: CatalogQuery) =>
    hasSignedInHint(document.cookie)
      ? catalogLoaderDeps(CATALOG_QUERY_DEFAULTS)
      : query
  );

/**
 * One track of the try-out catalog: its heading, its exam and group selectors and
 * its set list, read in one answer, so the page shows whole. The build prerenders that
 * answer and every reader gets it; a signed-in learner's table replaces its rows
 * with their own, read from Convex in the browser. Every set of the track opens in
 * the pane beside the table at the set's own address (the owner's notes of 20 Nov),
 * so the table stays where it is while a learner moves between sets; a set's paper
 * takes the whole page instead (`opensSetPaper`).
 */
export const Route = createFileRoute(
  "/$locale/_main/try-out/$country/$exam/$group/$track"
)({
  validateSearch: Schema.toStandardSchemaV1(CatalogQuery),
  search: { middlewares: [stripSearchParams(CATALOG_QUERY_DEFAULTS)] },
  loaderDeps: ({ search }) => catalogLoaderDeps(search),
  loader: async ({ deps, params }) => {
    const [route, messages] = await Promise.all([
      readStaticData(readTryoutTrackFn, {
        country: params.country,
        exam: params.exam,
        group: params.group,
        locale: params.locale,
        search: readLoaderQuery(deps),
        track: params.track,
      }),
      readStaticData(readRouteMessages, {
        locale: params.locale,
        namespaces: TRACK_NAMESPACES,
      }),
    ]);
    if (route.kind === "notFound") {
      throw notFound();
    }
    return { ...route, messages };
  },
  component: TryoutTrackLayout,
});

/** Joins the track's messages to the shell's, so the set's pane reads the learner's level and medals. */
function TryoutTrackLayout() {
  const { locale } = Route.useParams();
  const { messages } = Route.useLoaderData();
  const { messages: mainMessages } = mainRoute.useLoaderData();
  const shell = localeRoute.useLoaderData();
  return (
    <MessagesProvider
      locale={locale}
      messages={{ ...shell.messages, ...mainMessages, ...messages }}
      now={shell.now}
      timeZone={localeTimeZone(locale)}
    >
      <TryoutTrackFrame />
    </MessagesProvider>
  );
}

/** The track's table, with the open set's pane beside it, or the set's paper on the whole page. */
function TryoutTrackFrame() {
  const { locale } = Route.useParams();
  const route = Route.useLoaderData();
  const paper = useMatch({
    from: "/$locale/_main/try-out/$country/$exam/$group/$track/$set/",
    select: (match) =>
      opensSetPaper(
        match.search,
        match.loaderData?.page.entrySection?.visibility === "internal-entry"
      ),
    shouldThrow: false,
  });
  if (paper) {
    return <Outlet />;
  }
  return (
    <Page height="screen">
      <TryoutTrailHeader
        labels={route.labels}
        title={route.page.track.title}
        trail={route.trail}
      />
      <TryoutSetTable
        bootstrap={route.list}
        key={`${locale}:${route.page.track.publicPath}`}
      >
        <Outlet />
      </TryoutSetTable>
    </Page>
  );
}
