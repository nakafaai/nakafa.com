import { createFileRoute, notFound } from "@tanstack/react-router";
import { Schema } from "effect";
import { useState } from "react";
import { useStore } from "zustand";
import { ConvexIsland } from "@/components/providers/island";
import { ShellLockCarry, usePrepaintRelease } from "@/components/sidebar/lock";
import { AppNotFound } from "@/components/state/app";
import { TryoutAttemptReview } from "@/components/tryout/review/screen";
import { readTryoutSetFn } from "@/components/tryout/route/attempt.functions";
import { createTryoutHead } from "@/components/tryout/route/head";
import { TryoutAttemptIsland } from "@/components/tryout/route/island";
import {
  createLearnerReadStore,
  useAttemptSignIn,
  useKeepLearnerRead,
  useLearnerSet,
} from "@/components/tryout/route/live";
import { TryoutAttemptSearch } from "@/components/tryout/route/search";
import { TryoutClockProvider } from "@/components/tryout/runtime/clock";
import { TryoutSetPageClient } from "@/components/tryout/set/client";
import { readStaticData } from "@/lib/static/data";

/**
 * One set of a track. Its catalog view is the same for every visitor, so the build
 * prerenders it and every URL of the set is that page: no Worker renders it. A
 * signed-in learner's attempt, and the one a URL names with `?attemptId`, are read
 * in the browser once the session is known (`useLearnerSet`), and a URL bound to an
 * attempt answers for that attempt alone.
 */
/** What the page reads of a learner's attempt on the set. */
type LearnerSet = ReturnType<typeof useLearnerSet>;
type LearnerSetStore = ReturnType<typeof createLearnerReadStore<LearnerSet>>;

export const Route = createFileRoute(
  "/$locale/_main/try-out/$country/$exam/$track/$set/"
)({
  validateSearch: Schema.toStandardSchemaV1(TryoutAttemptSearch),
  loader: async ({ params }) => {
    const route = await readStaticData(readTryoutSetFn, {
      country: params.country,
      exam: params.exam,
      locale: params.locale,
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
  component: TryoutSetPage,
});

function TryoutSetPage() {
  const [learner] = useState(() => createLearnerReadStore<LearnerSet>());
  return (
    <>
      <ConvexIsland>
        <TryoutSetLearner store={learner} />
      </ConvexIsland>
      <TryoutSetView store={learner} />
    </>
  );
}

/** Reads a learner's attempt on the set in the browser, for the page beside it (`useLearnerSet`). */
function TryoutSetLearner({ store }: { readonly store: LearnerSetStore }) {
  const route = Route.useLoaderData();
  const search = Route.useSearch();
  const learner = useLearnerSet({ page: route.page, search });
  useKeepLearnerRead(store, learner);
  return <ShellLockCarry pending={learner.kind === "pending"} />;
}

/**
 * Draws the set from the learner read: the attempt's page, or the catalog's while there is none. It
 * stays mounted while the session starts. An address bound to an attempt without a session goes to
 * sign-in.
 */
function TryoutSetView({ store }: { readonly store: LearnerSetStore }) {
  const route = Route.useLoaderData();
  const search = Route.useSearch();
  const learner = useStore(store);
  useAttemptSignIn({ publicPath: route.page.set.publicPath, search });
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
          restartTarget: route.restartTarget,
        };
  return (
    // The clock starts again with the attempt, so its first render reads the browser's time.
    <TryoutClockProvider
      initialNow={route.now}
      key={view.binding?.attemptId ?? "catalog"}
    >
      <TryoutAttemptIsland live={view.binding !== null}>
        <TryoutSetPageClient
          binding={view.binding}
          content={view.content}
          page={view.page}
          pending={learner.kind === "pending"}
          restartTarget={view.restartTarget}
          route={route.route}
        >
          <TryoutAttemptReview binding={view.binding} />
        </TryoutSetPageClient>
      </TryoutAttemptIsland>
    </TryoutClockProvider>
  );
}
