import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { deleteContentProjectionsBySourcePath } from "@repo/backend/convex/contentSync/lib/syncHelpers";
import { hasSameSyncValues } from "@repo/backend/convex/contentSync/lib/syncValues";
import { getQuestionSet } from "@repo/backend/convex/contentSync/tryouts/questionBank";
import type {
  SyncedTryoutCountry,
  SyncedTryoutExam,
  SyncedTryoutSection,
  SyncedTryoutSet,
  SyncedTryoutTrack,
} from "@repo/backend/convex/contentSync/tryouts/spec";
import { ConvexError } from "convex/values";

export type TryoutSyncOutcome = "created" | "unchanged" | "updated";

/** Creates, replaces, or preserves one localized try-out country row. */
export async function syncTryoutCountry(
  ctx: MutationCtx,
  country: SyncedTryoutCountry,
  syncedAt: number
): Promise<TryoutSyncOutcome> {
  const existing = await ctx.db
    .query("tryoutCountries")
    .withIndex("by_countryKey_and_locale", (query) =>
      query.eq("countryKey", country.countryKey).eq("locale", country.locale)
    )
    .unique();

  if (hasSameDescribedValues(country, existing)) {
    return "unchanged";
  }

  const nextValues = { ...country, syncedAt };
  if (existing) {
    await deleteChangedPublicPathProjection(ctx, existing, nextValues);
    await ctx.db.replace("tryoutCountries", existing._id, nextValues);
    return "updated";
  }

  await ctx.db.insert("tryoutCountries", nextValues);
  return "created";
}

/** Creates, replaces, or preserves one localized try-out exam row. */
export async function syncTryoutExam(
  ctx: MutationCtx,
  exam: SyncedTryoutExam,
  syncedAt: number
): Promise<TryoutSyncOutcome> {
  const existing = await ctx.db
    .query("tryoutExams")
    .withIndex("by_countryKey_and_examKey_and_locale", (query) =>
      query
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
    await deleteChangedPublicPathProjection(ctx, existing, nextValues);
    await ctx.db.replace("tryoutExams", existing._id, nextValues);
    return "updated";
  }

  await ctx.db.insert("tryoutExams", nextValues);
  return "created";
}

/** Creates, replaces, or preserves one localized try-out set row. */
export async function syncTryoutSet(
  ctx: MutationCtx,
  set: SyncedTryoutSet,
  syncedAt: number
): Promise<TryoutSyncOutcome> {
  const existing = await ctx.db
    .query("tryoutSets")
    .withIndex(
      "by_countryKey_and_examKey_and_trackKey_and_setKey_and_locale",
      (query) =>
        query
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
    await deleteChangedPublicPathProjection(ctx, existing, nextValues);
    await ctx.db.replace("tryoutSets", existing._id, nextValues);
    return "updated";
  }

  await ctx.db.insert("tryoutSets", nextValues);
  return "created";
}

/** Creates, replaces, or preserves one localized try-out track row. */
export async function syncTryoutTrack(
  ctx: MutationCtx,
  track: SyncedTryoutTrack,
  syncedAt: number
): Promise<TryoutSyncOutcome> {
  const existing = await ctx.db
    .query("tryoutTracks")
    .withIndex("by_countryKey_and_examKey_and_trackKey_and_locale", (query) =>
      query
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
    await deleteChangedPublicPathProjection(ctx, existing, nextValues);
    await ctx.db.replace("tryoutTracks", existing._id, nextValues);
    return "updated";
  }

  await ctx.db.insert("tryoutTracks", nextValues);
  return "created";
}

/** Resolves parents and synchronizes one localized try-out section row. */
export async function syncTryoutSection(
  ctx: MutationCtx,
  section: SyncedTryoutSection,
  syncedAt: number
): Promise<TryoutSyncOutcome> {
  const [tryoutSet, questionSet] = await Promise.all([
    getTryoutSet(ctx, section),
    getQuestionSet(ctx, {
      locale: section.locale,
      sourcePath: section.questionSourcePath,
    }),
  ]);
  const existing = await ctx.db
    .query("tryoutSections")
    .withIndex("by_tryoutSetId_and_sectionKey", (query) =>
      query
        .eq("tryoutSetId", tryoutSet._id)
        .eq("sectionKey", section.sectionKey)
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
    await deleteChangedPublicPathProjection(ctx, existing, nextValues);
    await ctx.db.replace("tryoutSections", existing._id, writeValues);
    return "updated";
  }

  await ctx.db.insert("tryoutSections", writeValues);
  return "created";
}

/** Resolves the concrete parent set for one synchronized section. */
export async function getTryoutSet(
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
      (query) =>
        query
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

/** Compares all source-owned set fields that influence runtime behavior. */
function hasSameSetValues(
  nextValues: SyncedTryoutSet,
  existing: Partial<SyncedTryoutSet> | null | undefined
) {
  return (
    hasSameDescribedValues(nextValues, existing) &&
    existing?.internalEntrySectionKey === nextValues.internalEntrySectionKey
  );
}

/** Compares all source-owned section fields and resolved relationships. */
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

/** Removes an obsolete route projection before replacing a public path. */
async function deleteChangedPublicPathProjection(
  ctx: MutationCtx,
  existing:
    | { locale: SyncedTryoutCountry["locale"]; publicPath?: string }
    | null
    | undefined,
  nextValues: { publicPath?: string }
) {
  if (
    !(existing?.publicPath && existing.publicPath !== nextValues.publicPath)
  ) {
    return;
  }

  await deleteContentProjectionsBySourcePath(ctx, {
    locale: existing.locale,
    route: existing.publicPath,
  });
}
