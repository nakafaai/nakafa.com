import {
  makeBreadcrumbNodes,
  makePracticeTestNode,
} from "@repo/seo/jsonld/node";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { createFileRoute, notFound, useHydrated } from "@tanstack/react-router";
import { Array as Arr, Effect, Number as Num, Schema } from "effect";
import { ClockProvider } from "@/components/player/now";
import { ConvexIsland } from "@/components/providers/island";
import { ShellLockCarry, usePrepaintRelease } from "@/components/sidebar/lock";
import { AppNotFound } from "@/components/state/app";
import {
  TryoutPractice,
  TryoutPracticeSession,
  useTryoutPracticing,
} from "@/components/tryout/practice/deferred";
import { TryoutAttemptReview } from "@/components/tryout/review/deferred";
import { readTryoutSetFn } from "@/components/tryout/route/attempt.functions";
import { createTryoutHead } from "@/components/tryout/route/head";
import { attemptOf } from "@/components/tryout/route/intent";
import {
  useAttemptSignIn,
  useKeptLearnerRead,
  useLearnerSet,
} from "@/components/tryout/route/live";
import {
  opensSetPaper,
  TryoutAttemptSearch,
} from "@/components/tryout/route/search";
import { TryoutPressProvider } from "@/components/tryout/runtime/start";
import { TryoutSetPageClient } from "@/components/tryout/set/client";
import { warmSetReads } from "@/components/tryout/set/reads";
import { readSetSections } from "@/components/tryout/set/sections";
import { TryoutPage } from "@/components/tryout/shell/header";
import { readStaticData } from "@/lib/static/data";

/**
 * One set of a track. Its catalog view is the same for every visitor, so the build
 * prerenders it, and every URL of the set is that page for every reader: no Worker
 * renders it. A signed-in learner's attempt, and the one a URL names with
 * `?attemptId`, are read in the browser once the session is known (`useLearnerSet`),
 * and a URL bound to an attempt answers for that attempt alone.
 */
/** The read of a page without a Convex client: a visitor's. */
const VISITOR = { kind: "visitor" } as const;

export const Route = createFileRoute(
  "/$locale/_main/try-out/$country/$exam/$group/$track/$set/"
)({
  validateSearch: Schema.toStandardSchemaV1(TryoutAttemptSearch),
  // The loader's data is the set as the build prerendered it, the same for every address of the set, so the
  // attempt an address names is no dependency of it. Were it one, the router would name the match of an
  // attempt's address apart from the prerendered match it hydrates, read the set again in the browser, and
  // hydrate the pane against the learner's tree instead of the visitor's markup the server wrote.
  loader: async ({ location, params }) => {
    const route = await readStaticData(readTryoutSetFn, {
      country: params.country,
      exam: params.exam,
      group: params.group,
      locale: params.locale,
      set: params.set,
      track: params.track,
    });
    if (route.kind === "notFound") {
      throw notFound();
    }
    // A learner's set opens whole: the page stays until their reads of it answer (`warmSetReads`).
    await Effect.runPromise(
      warmSetReads({
        attemptId: attemptOf(location.search),
        locale: params.locale,
        set: route.page.set,
      })
    );
    return route;
  },
  head: ({ loaderData, match, params }) =>
    loaderData === undefined
      ? {}
      : createTryoutHead({
          alternates: loaderData.head.alternates,
          canonicalPath: loaderData.head.canonicalPath,
          description: loaderData.head.description,
          image: loaderData.head.image,
          // A URL bound to one attempt is personal, and one that names a view or a question repeats the page,
          // so only the bare address is indexed.
          indexable:
            loaderData.head.indexable &&
            match.search.attemptId === undefined &&
            match.search.mode === undefined &&
            match.search.question === undefined &&
            match.search.view === undefined,
          jsonLd: [
            ...makeBreadcrumbNodes(loaderData.head.breadcrumbs),
            makePracticeTestNode({
              description: loaderData.head.description,
              exam: `${loaderData.page.exam.title} ${loaderData.page.group.title} ${loaderData.page.track.title}`,
              inLanguage: params.locale,
              name: loaderData.head.title,
              timeLimitSeconds: Num.sumAll(
                Arr.map(
                  readSetSections(loaderData.page),
                  ({ timeLimitSeconds }) => timeLimitSeconds
                )
              ),
              url: new URL(loaderData.head.canonicalPath, SITE_ORIGIN).href,
            }),
          ],
          locale: params.locale,
          title: loaderData.head.title,
        }),
  component: TryoutSetPage,
});

function TryoutSetPage() {
  const setPath = Route.useLoaderData({
    select: (route) => route.page.set.publicPath,
  });
  return (
    // A visitor's page holds no Convex client, so it draws the set as every visitor sees it, which the
    // build prerenders; a learner's page reads their attempt once it holds the client. A press belongs
    // to its page, so the next set starts with none.
    <TryoutPressProvider key={setPath}>
      <ConvexIsland fallback={<TryoutSetVisitor />} keepsPress>
        <TryoutSetLearner />
      </ConvexIsland>
    </TryoutPressProvider>
  );
}

/** The set as every visitor sees it. An address bound to an attempt goes to sign-in. */
function TryoutSetVisitor() {
  const route = Route.useLoaderData();
  const search = Route.useSearch();
  useAttemptSignIn({ publicPath: route.page.set.publicPath, search });
  return <TryoutSetView learner={VISITOR} />;
}

/** A learner's set: their attempt through it, read in the browser (`useLearnerSet`). */
function TryoutSetLearner() {
  const route = Route.useLoaderData();
  const search = Route.useSearch();
  const learner = useKeptLearnerRead(
    useLearnerSet({ page: route.page, search })
  );
  return (
    <>
      <ShellLockCarry pending={learner.kind === "pending"} />
      <TryoutSetView learner={learner} />
    </>
  );
}

/** Draws the set from the learner read: the attempt's page, or the catalog's while there is none. */
function TryoutSetView({
  learner,
}: {
  readonly learner: ReturnType<typeof useLearnerSet>;
}) {
  const route = Route.useLoaderData();
  const search = Route.useSearch();
  const practicing = useTryoutPracticing();
  const hydrated = useHydrated();
  // A read that answered decides the shell's lock, so the first frame's lock can go.
  usePrepaintRelease(
    learner.kind === "attempt" ||
      learner.kind === "none" ||
      learner.kind === "notFound"
  );
  if (learner.kind === "notFound") {
    return <AppNotFound locale={route.route.locale} />;
  }
  const entry = route.page.entrySection;
  // A set entered through one section practises that section, for a learner whose read answered.
  if (
    practicing &&
    entry !== null &&
    (learner.kind === "attempt" || learner.kind === "none")
  ) {
    const { set } = route.page;
    const target = {
      countryKey: set.countryKey,
      examKey: set.examKey,
      locale: route.route.locale,
      sectionKey: entry.sectionKey,
      setKey: set.setKey,
      trackKey: set.trackKey,
    };
    return (
      <TryoutPage>
        <TryoutPractice target={target} title={set.title}>
          <TryoutPracticeSession
            returnAddress={{ publicPath: set.publicPath }}
            target={target}
            title={set.title}
          />
        </TryoutPractice>
      </TryoutPage>
    );
  }
  const view =
    learner.kind === "attempt"
      ? learner.value
      : {
          binding: null,
          content: null,
          page: route.page,
          restartTarget: route.restartTarget,
        };
  // The page hydrates as the bare address the build prerendered, and opens the paper its address names once it has.
  const paper =
    hydrated &&
    opensSetPaper(
      search,
      route.page.entrySection?.visibility === "internal-entry"
    );
  return (
    // The clock starts again with the attempt, so its first render reads the browser's time.
    <ClockProvider
      key={view.binding?.attemptId ?? "catalog"}
      renderedAt={route.now}
    >
      <TryoutSetPageClient
        binding={view.binding}
        content={view.content}
        page={view.page}
        paper={paper}
        pending={
          learner.kind === "pending" || (paper && learner.kind === "visitor")
        }
        restartTarget={view.restartTarget}
        route={route.route}
      >
        <TryoutAttemptReview binding={view.binding} />
      </TryoutSetPageClient>
    </ClockProvider>
  );
}
