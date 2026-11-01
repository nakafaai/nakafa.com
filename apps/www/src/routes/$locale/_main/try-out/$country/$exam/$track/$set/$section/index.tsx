import { createFileRoute, notFound } from "@tanstack/react-router";
import { Schema } from "effect";
import { useState } from "react";
import { useStore } from "zustand";
import { ConvexIsland } from "@/components/providers/island";
import { ShellLockCarry, usePrepaintRelease } from "@/components/sidebar/lock";
import { AppNotFound } from "@/components/state/app";
import { TryoutAttemptReview } from "@/components/tryout/review/deferred";
import { readTryoutSectionFn } from "@/components/tryout/route/attempt.functions";
import { createTryoutHead } from "@/components/tryout/route/head";
import { TryoutAttemptIsland } from "@/components/tryout/route/island";
import {
  createLearnerReadStore,
  useAttemptSignIn,
  useKeepLearnerRead,
  useLearnerSection,
} from "@/components/tryout/route/live";
import { TryoutAttemptSearch } from "@/components/tryout/route/search";
import { TryoutClockProvider } from "@/components/tryout/runtime/clock";
import { TryoutSectionPageClient } from "@/components/tryout/section/client";
import { readStaticData } from "@/lib/static/data";

/**
 * One section of a set. Its catalog view is shared, so the build prerenders it and
 * every URL of the section is that page: no Worker renders it. A signed-in learner's
 * attempt through it, and the one a URL names with `?attemptId`, are read in the
 * browser once the session is known (`useLearnerSection`), and a URL bound to an
 * attempt answers for that attempt alone.
 */
/** What the page reads of a learner's attempt through the section. */
type LearnerSection = ReturnType<typeof useLearnerSection>;
type LearnerSectionStore = ReturnType<
  typeof createLearnerReadStore<LearnerSection>
>;

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
          alternates: loaderData.head.alternates,
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
  const [learner] = useState(() => createLearnerReadStore<LearnerSection>());
  return (
    <>
      <ConvexIsland>
        <TryoutSectionLearner store={learner} />
      </ConvexIsland>
      <TryoutSectionView store={learner} />
    </>
  );
}

/** Reads a learner's attempt through the section in the browser, for the page beside it (`useLearnerSection`). */
function TryoutSectionLearner({
  store,
}: {
  readonly store: LearnerSectionStore;
}) {
  const route = Route.useLoaderData();
  const search = Route.useSearch();
  const learner = useLearnerSection({
    page: route.page,
    publicPath: route.sectionPath,
    search,
    setPath: route.setPath,
  });
  useKeepLearnerRead(store, learner);
  return <ShellLockCarry pending={learner.kind === "pending"} />;
}

/**
 * Draws the section from the learner read: the attempt's page, or the catalog's while there is none.
 * It stays mounted while the session starts, so a press on its start survives. An address bound to an
 * attempt without a session goes to sign-in.
 */
function TryoutSectionView({ store }: { readonly store: LearnerSectionStore }) {
  const route = Route.useLoaderData();
  const search = Route.useSearch();
  const learner = useStore(store);
  useAttemptSignIn({ publicPath: route.sectionPath, search });
  // A read that answered decides the shell's lock, so the first frame's lock can go.
  usePrepaintRelease(
    learner.kind === "attempt" ||
      learner.kind === "none" ||
      learner.kind === "notFound"
  );
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
      <TryoutAttemptIsland live={view.binding !== null}>
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
      </TryoutAttemptIsland>
    </TryoutClockProvider>
  );
}
