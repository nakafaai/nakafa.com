import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { assertContentSyncBatchSize } from "@repo/backend/convex/contentSync/lib/errors";
import { buildAuthorCache } from "@repo/backend/convex/contentSync/lib/syncHelpers";
import {
  getTryoutSet,
  syncTryoutCountry,
  syncTryoutExam,
  syncTryoutSection,
  syncTryoutSet,
  syncTryoutTrack,
  type TryoutSyncOutcome,
} from "@repo/backend/convex/contentSync/tryouts/catalog";
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
} from "@repo/backend/convex/contentSync/tryouts/spec";

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
export async function bulkSyncTryoutsImpl(
  ctx: MutationCtx,
  args: BulkSyncTryoutsArgs,
  options: { readonly syncLegacyIrt: boolean }
) {
  assertTryoutBatchSizes(args);

  const now = Date.now();
  const totals: SyncTotals = { created: 0, unchanged: 0, updated: 0 };

  for (const route of args.routes) {
    await syncTryoutRoute(ctx, route, now);
  }
  for (const country of args.countries) {
    addOutcome(totals, await syncTryoutCountry(ctx, country, now));
  }
  for (const exam of args.exams) {
    addOutcome(totals, await syncTryoutExam(ctx, exam, now));
  }
  for (const track of args.tracks) {
    addOutcome(totals, await syncTryoutTrack(ctx, track, now));
  }
  for (const set of args.sets) {
    addOutcome(totals, await syncTryoutSet(ctx, set, now));
  }
  for (const questionSet of args.questionSets) {
    addOutcome(totals, await syncQuestionSet(ctx, questionSet, now));
  }
  const questionAuthorCache = await buildAuthorCache(
    ctx,
    args.questions.flatMap((question) =>
      question.authors.map((author) => author.name)
    )
  );

  for (const question of args.questions) {
    addOutcome(
      totals,
      await syncQuestion(ctx, question, now, questionAuthorCache)
    );
  }
  for (const section of args.sections) {
    addOutcome(totals, await syncTryoutSection(ctx, section, now));
  }
  if (options.syncLegacyIrt) {
    await syncIrtScalesForSections(ctx, args.sections, now);
  }

  return totals;
}

/** Reject a combined try-out sync batch before any transactional writes. */
function assertTryoutBatchSizes(args: BulkSyncTryoutsArgs) {
  assertContentSyncBatchSize({
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
  assertContentSyncBatchSize({
    functionName: "bulkSyncTryouts",
    limit: CONTENT_SYNC_BATCH_LIMITS.tryoutSets,
    received: args.routes.length,
    unit: "try-out route projections",
  });
  assertContentSyncBatchSize({
    functionName: "bulkSyncTryouts",
    limit: CONTENT_SYNC_BATCH_LIMITS.questionSets,
    received: args.questionSets.length,
    unit: "question sets",
  });
  assertContentSyncBatchSize({
    functionName: "bulkSyncTryouts",
    limit: CONTENT_SYNC_BATCH_LIMITS.questions,
    received: args.questions.length,
    unit: "questions",
  });
}

/** Add one row-level sync outcome to the aggregate totals. */
function addOutcome(totals: SyncTotals, outcome: TryoutSyncOutcome) {
  totals[outcome]++;
}

/** Synchronize each affected set's IRT scale once per section batch. */
async function syncIrtScalesForSections(
  ctx: MutationCtx,
  sections: SyncedTryoutSection[],
  syncedAt: number
) {
  const syncedSetIds = new Set<string>();

  for (const section of sections) {
    const set = await getTryoutSet(ctx, section);

    if (syncedSetIds.has(set._id)) {
      continue;
    }

    syncedSetIds.add(set._id);
    await syncIrtScaleForSet(ctx, { set, syncedAt });
  }
}
