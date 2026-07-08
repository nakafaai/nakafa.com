import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { assertContentSyncBatchSize } from "@repo/backend/convex/contentSync/lib/errors";
import {
  buildAuthorCache,
  deleteContentProjectionsBySourcePath,
} from "@repo/backend/convex/contentSync/lib/syncHelpers";
import { hasSameSyncValues } from "@repo/backend/convex/contentSync/lib/syncValues";
import { syncIrtScaleForSet } from "@repo/backend/convex/contentSync/tryouts/irt";
import {
  getQuestionSet,
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
import { ConvexError } from "convex/values";

type SyncOutcome = "created" | "unchanged" | "updated";

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
  args: BulkSyncTryoutsArgs
) {
  assertTryoutBatchSizes(args);

  const now = Date.now();
  const totals: SyncTotals = { created: 0, unchanged: 0, updated: 0 };

  for (const route of args.routes) {
    await syncTryoutRoute(ctx, route, now);
  }
  for (const country of args.countries) {
    addOutcome(totals, await syncCountry(ctx, country, now));
  }
  for (const exam of args.exams) {
    addOutcome(totals, await syncExam(ctx, exam, now));
  }
  for (const track of args.tracks) {
    addOutcome(totals, await syncTrack(ctx, track, now));
  }
  for (const set of args.sets) {
    addOutcome(totals, await syncSet(ctx, set, now));
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
    addOutcome(totals, await syncSection(ctx, section, now));
  }
  await syncIrtScalesForSections(ctx, args.sections, now);

  return totals;
}

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

function addOutcome(totals: SyncTotals, outcome: SyncOutcome) {
  totals[outcome]++;
}

async function syncCountry(
  ctx: MutationCtx,
  country: SyncedTryoutCountry,
  syncedAt: number
): Promise<SyncOutcome> {
  const existing = await ctx.db
    .query("tryoutCountries")
    .withIndex("by_countryKey_and_locale", (q) =>
      q.eq("countryKey", country.countryKey).eq("locale", country.locale)
    )
    .unique();

  if (hasSameDescribedValues(country, existing)) {
    return "unchanged";
  }

  const nextValues = { ...country, syncedAt };

  if (existing) {
    await ctx.db.replace("tryoutCountries", existing._id, nextValues);
    return "updated";
  }

  await ctx.db.insert("tryoutCountries", nextValues);
  return "created";
}

async function syncExam(
  ctx: MutationCtx,
  exam: SyncedTryoutExam,
  syncedAt: number
): Promise<SyncOutcome> {
  const existing = await ctx.db
    .query("tryoutExams")
    .withIndex("by_countryKey_and_examKey_and_locale", (q) =>
      q
        .eq("countryKey", exam.countryKey)
        .eq("examKey", exam.examKey)
        .eq("locale", exam.locale)
    )
    .unique();

  if (hasSameDescribedValues(exam, existing)) {
    return "unchanged";
  }

  const nextValues = { ...exam, syncedAt };

  if (existing) {
    await ctx.db.replace("tryoutExams", existing._id, nextValues);
    return "updated";
  }

  await ctx.db.insert("tryoutExams", nextValues);
  return "created";
}

async function syncSet(
  ctx: MutationCtx,
  set: SyncedTryoutSet,
  syncedAt: number
): Promise<SyncOutcome> {
  const existing = await ctx.db
    .query("tryoutSets")
    .withIndex(
      "by_countryKey_and_examKey_and_trackKey_and_setKey_and_locale",
      (q) =>
        q
          .eq("countryKey", set.countryKey)
          .eq("examKey", set.examKey)
          .eq("trackKey", set.trackKey)
          .eq("setKey", set.setKey)
          .eq("locale", set.locale)
    )
    .unique();

  if (hasSameSetValues(set, existing)) {
    return "unchanged";
  }

  const nextValues = { ...set, syncedAt };

  if (existing) {
    await ctx.db.replace("tryoutSets", existing._id, nextValues);
    return "updated";
  }

  await ctx.db.insert("tryoutSets", nextValues);
  return "created";
}

async function syncTrack(
  ctx: MutationCtx,
  track: SyncedTryoutTrack,
  syncedAt: number
): Promise<SyncOutcome> {
  const existing = await ctx.db
    .query("tryoutTracks")
    .withIndex("by_countryKey_and_examKey_and_trackKey_and_locale", (q) =>
      q
        .eq("countryKey", track.countryKey)
        .eq("examKey", track.examKey)
        .eq("trackKey", track.trackKey)
        .eq("locale", track.locale)
    )
    .unique();

  if (hasSameDescribedValues(track, existing)) {
    return "unchanged";
  }

  const nextValues = { ...track, syncedAt };

  if (existing) {
    await ctx.db.replace("tryoutTracks", existing._id, nextValues);
    return "updated";
  }

  await ctx.db.insert("tryoutTracks", nextValues);
  return "created";
}

async function syncSection(
  ctx: MutationCtx,
  section: SyncedTryoutSection,
  syncedAt: number
): Promise<SyncOutcome> {
  const [tryoutSet, questionSet] = await Promise.all([
    getTryoutSet(ctx, section),
    getQuestionSet(ctx, {
      locale: section.locale,
      sourcePath: section.questionSourcePath,
    }),
  ]);
  const existing = await ctx.db
    .query("tryoutSections")
    .withIndex("by_tryoutSetId_and_sectionKey", (q) =>
      q.eq("tryoutSetId", tryoutSet._id).eq("sectionKey", section.sectionKey)
    )
    .unique();
  const nextValues = {
    ...section,
    questionSetId: questionSet._id,
    tryoutSetId: tryoutSet._id,
  };

  if (hasSameSectionValues(nextValues, existing)) {
    return "unchanged";
  }

  const writeValues = { ...nextValues, syncedAt };

  if (existing) {
    if (existing.publicPath && existing.publicPath !== nextValues.publicPath) {
      await deleteContentProjectionsBySourcePath(ctx, {
        locale: existing.locale,
        route: existing.publicPath,
      });
    }

    await ctx.db.replace("tryoutSections", existing._id, writeValues);
    return "updated";
  }

  await ctx.db.insert("tryoutSections", writeValues);
  return "created";
}

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

async function getTryoutSet(
  ctx: MutationCtx,
  section: Pick<
    SyncedTryoutSection,
    "countryKey" | "examKey" | "locale" | "setKey" | "trackKey"
  >
) {
  const tryoutSet = await ctx.db
    .query("tryoutSets")
    .withIndex(
      "by_countryKey_and_examKey_and_trackKey_and_setKey_and_locale",
      (q) =>
        q
          .eq("countryKey", section.countryKey)
          .eq("examKey", section.examKey)
          .eq("trackKey", section.trackKey)
          .eq("setKey", section.setKey)
          .eq("locale", section.locale)
    )
    .unique();

  if (!tryoutSet) {
    throw new ConvexError({
      code: "TRYOUT_SYNC_SET_NOT_FOUND",
      message: `Missing try-out set ${section.countryKey}/${section.examKey}/${section.trackKey}/${section.setKey}/${section.locale}.`,
    });
  }

  return tryoutSet;
}

/** Checks source-owned optional fields that can disappear between sync runs. */
function hasSameDescribedValues<TValues extends { description?: string }>(
  nextValues: TValues,
  existing: Partial<TValues> | null | undefined
) {
  return (
    hasSameSyncValues(nextValues, existing) &&
    existing?.description === nextValues.description
  );
}

function hasSameSetValues(
  nextValues: SyncedTryoutSet,
  existing: Partial<SyncedTryoutSet> | null | undefined
) {
  return (
    hasSameDescribedValues(nextValues, existing) &&
    existing?.internalEntrySectionKey === nextValues.internalEntrySectionKey
  );
}

function hasSameSectionValues(
  nextValues: SyncedTryoutSection & {
    questionSetId: string;
    tryoutSetId: string;
  },
  existing: Partial<typeof nextValues> | null | undefined
) {
  return (
    hasSameDescribedValues(nextValues, existing) &&
    existing?.publicPath === nextValues.publicPath
  );
}
