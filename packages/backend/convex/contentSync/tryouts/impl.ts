import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { buildAuthorCache } from "@repo/backend/convex/contentSync/lib/syncHelpers";
import {
  getTryoutSet,
  syncTryoutCountry,
  syncTryoutExam,
  syncTryoutSection,
  syncTryoutSet,
  syncTryoutTrack,
} from "@repo/backend/convex/contentSync/tryouts/catalog";
import { validateTryoutBatch } from "@repo/backend/convex/contentSync/tryouts/error";
import { syncIrtScaleForSet } from "@repo/backend/convex/contentSync/tryouts/irt";
import {
  syncQuestion,
  syncQuestionSet,
} from "@repo/backend/convex/contentSync/tryouts/questionBank";
import { syncTryoutRoute } from "@repo/backend/convex/contentSync/tryouts/route";
import type {
  SyncedQuestion,
  SyncedQuestionSet,
  SyncedTryoutCountry,
  SyncedTryoutExam,
  SyncedTryoutRoute,
  SyncedTryoutSection,
  SyncedTryoutSet,
  SyncedTryoutTrack,
  TryoutSyncOutcome,
} from "@repo/backend/convex/contentSync/tryouts/spec";
import { Effect } from "effect";

interface SyncTotals {
  created: number;
  unchanged: number;
  updated: number;
}

export interface BulkSyncTryoutsArgs {
  countries: SyncedTryoutCountry[];
  exams: SyncedTryoutExam[];
  questionSets: SyncedQuestionSet[];
  questions: SyncedQuestion[];
  routes: SyncedTryoutRoute[];
  sections: SyncedTryoutSection[];
  sets: SyncedTryoutSet[];
  tracks: SyncedTryoutTrack[];
}

/** Upserts one bounded try-out catalog and question-bank batch. */
export const syncTryouts = Effect.fn("contentSync.tryout.sync")(function* (
  ctx: MutationCtx,
  args: BulkSyncTryoutsArgs
) {
  yield* validateTryoutBatchSizes(args);

  const now = Date.now();
  const totals: SyncTotals = { created: 0, unchanged: 0, updated: 0 };

  for (const route of args.routes) {
    yield* syncTryoutRoute(ctx, route, now);
  }
  for (const country of args.countries) {
    addOutcome(totals, yield* syncTryoutCountry(ctx, country, now));
  }
  for (const exam of args.exams) {
    addOutcome(totals, yield* syncTryoutExam(ctx, exam, now));
  }
  for (const track of args.tracks) {
    addOutcome(totals, yield* syncTryoutTrack(ctx, track, now));
  }
  for (const set of args.sets) {
    addOutcome(totals, yield* syncTryoutSet(ctx, set, now));
  }
  for (const questionSet of args.questionSets) {
    addOutcome(totals, yield* syncQuestionSet(ctx, questionSet, now));
  }
  const questionAuthorCache = yield* Effect.promise(() =>
    buildAuthorCache(
      ctx,
      args.questions.flatMap((question) =>
        question.authors.map((author) => author.name)
      )
    )
  );

  for (const question of args.questions) {
    addOutcome(
      totals,
      yield* syncQuestion(ctx, question, now, questionAuthorCache)
    );
  }
  for (const section of args.sections) {
    addOutcome(totals, yield* syncTryoutSection(ctx, section, now));
  }
  yield* syncIrtScalesForSections(ctx, args.sections, now);

  return totals;
});

/** Reject a combined try-out sync batch before any transactional writes. */
const validateTryoutBatchSizes = Effect.fn(
  "contentSync.tryout.validateBatchSizes"
)(function* (args: BulkSyncTryoutsArgs) {
  yield* validateTryoutBatch({
    functionName: "bulkSyncTryouts",
    limit: CONTENT_SYNC_BATCH_LIMITS.tryoutSets,
    received:
      args.countries.length +
      args.exams.length +
      args.tracks.length +
      args.sets.length +
      args.sections.length,
    unit: "try-out catalog rows",
  });
  yield* validateTryoutBatch({
    functionName: "bulkSyncTryouts",
    limit: CONTENT_SYNC_BATCH_LIMITS.tryoutSets,
    received: args.routes.length,
    unit: "try-out route projections",
  });
  yield* validateTryoutBatch({
    functionName: "bulkSyncTryouts",
    limit: CONTENT_SYNC_BATCH_LIMITS.questionSets,
    received: args.questionSets.length,
    unit: "question sets",
  });
  yield* validateTryoutBatch({
    functionName: "bulkSyncTryouts",
    limit: CONTENT_SYNC_BATCH_LIMITS.questions,
    received: args.questions.length,
    unit: "questions",
  });
});

/** Add one row-level sync outcome to the aggregate totals. */
function addOutcome(totals: SyncTotals, outcome: TryoutSyncOutcome) {
  totals[outcome]++;
}

/** Synchronize each affected set's IRT scale once per section batch. */
const syncIrtScalesForSections = Effect.fn("contentSync.tryout.syncIrtScales")(
  function* (
    ctx: MutationCtx,
    sections: SyncedTryoutSection[],
    syncedAt: number
  ) {
    const syncedSetIds = new Set<string>();

    for (const section of sections) {
      const set = yield* getTryoutSet(ctx, section);

      if (syncedSetIds.has(set._id)) {
        continue;
      }

      syncedSetIds.add(set._id);
      yield* syncIrtScaleForSet(ctx, { set, syncedAt });
    }
  }
);
