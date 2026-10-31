import { createFileRoute, notFound } from "@tanstack/react-router";
import { Schema } from "effect";
import { ConvexIsland } from "@/components/providers/island";
import { AppNotFound } from "@/components/state/app";
import { TryoutAttemptReview } from "@/components/tryout/review/screen";
import { readTryoutSectionFn } from "@/components/tryout/route/attempt.functions";
import { createTryoutHead } from "@/components/tryout/route/head";
import {
  useAttemptSignIn,
  useLearnerSection,
} from "@/components/tryout/route/live";
import { TryoutAttemptSearch } from "@/components/tryout/route/search";
import { TryoutClockProvider } from "@/components/tryout/runtime/clock";
import { TryoutSectionPageClient } from "@/components/tryout/section/client";
import { readStaticData } from "@/lib/static/data";

/**
 * One section of a set. Its catalog view is shared, so the build prerenders it and
 * keeps its answer, and every URL of the section reads that answer: the Worker
 * renders nothing personal. A signed-in learner's attempt through it, and the one a
 * URL names with `?attemptId`, are read in the browser once the session is known
 * (`useLearnerSection`), and a URL bound to an attempt answers for that attempt alone.
 */
/** The read of a page without a Convex client: a visitor's. */
const VISITOR = { kind: "visitor" } as const;

export const Route = createFileRoute(
  "/$locale/_main/try-out/$country/$exam/$track/$set/$section/"
)({
  validateSearch: Schema.toStandardSchemaV1(TryoutAttemptSearch),
  loader: async ({ params }) => {
    const route = await readStaticData(readTryoutSectionFn, {
      country: params.country,
      exam: params.exam,
      locale: params.locale,
      section: params.section,
      set: params.set,
      track: params.track,
    });
    if (route.kind === "notFound") {
      throw notFound();
    }
    return route;
  },
  head: ({ loaderData, match, params }) =>
    loaderData === undefined
      ? {}
      : createTryoutHead({
          canonicalPath: loaderData.head.canonicalPath,
          description: loaderData.head.description,
          image: loaderData.head.image,
          // A URL bound to one attempt is personal, and one that names a view repeats the page,
          // so only the bare address is indexed.
          indexable:
            loaderData.head.indexable &&
            match.search.attemptId === undefined &&
            match.search.view === undefined,
          jsonLd: [],
          locale: params.locale,
          title: loaderData.head.title,
        }),
  component: TryoutSectionPage,
});

function TryoutSectionPage() {
  return (
    // A visitor's page holds no Convex client, so it draws the section as every visitor sees it, which the
    // build prerenders; a learner's page reads their attempt once it holds the client.
    <ConvexIsland fallback={<TryoutSectionVisitor />}>
      <TryoutSectionLearner />
    </ConvexIsland>
  );
}

/** The section as every visitor sees it. An address bound to an attempt goes to sign-in. */
function TryoutSectionVisitor() {
  const route = Route.useLoaderData();
  const search = Route.useSearch();
  useAttemptSignIn({ publicPath: route.sectionPath, search });
  return <TryoutSectionView learner={VISITOR} />;
}

/** A learner's section: their attempt through it, read in the browser (`useLearnerSection`). */
function TryoutSectionLearner() {
  const route = Route.useLoaderData();
  const search = Route.useSearch();
  const signedIn = Route.useRouteContext({
    select: (context) => context.signedIn,
  });
  const learner = useLearnerSection({
    page: route.page,
    publicPath: route.sectionPath,
    search,
    setPath: route.setPath,
    signedIn,
  });
  return <TryoutSectionView learner={learner} />;
}

/** Draws the section from the learner read: the attempt's page, or the catalog's while there is none. */
function TryoutSectionView({
  learner,
}: {
  readonly learner: ReturnType<typeof useLearnerSection>;
}) {
  const route = Route.useLoaderData();
  if (learner.kind === "notFound") {
    return <AppNotFound locale={route.route.locale} />;
  }
  const view =
    learner.kind === "attempt"
      ? learner.value
      : {
          binding: null,
          content: null,
          page: route.page,
          setPath: route.setPath,
        };
  return (
    // The clock starts again with the attempt, so its first render reads the browser's time.
    <TryoutClockProvider
      initialNow={route.now}
      key={view.binding?.attemptId ?? "catalog"}
    >
      <TryoutSectionPageClient
        binding={view.binding}
        content={view.content}
        page={view.page}
        pending={learner.kind === "pending"}
        route={route.route}
        setPath={view.setPath}
      >
        <TryoutAttemptReview binding={view.binding} />
      </TryoutSectionPageClient>
    </TryoutClockProvider>
  );
}
