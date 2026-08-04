import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { deleteContentProjectionsBySourcePath } from "@repo/backend/convex/contentSync/lib/syncHelpers";
import { hasSameSyncValues } from "@repo/backend/convex/contentSync/lib/syncValues";
import { tryoutSyncFail } from "@repo/backend/convex/contentSync/tryouts/error";
import { getQuestionSet } from "@repo/backend/convex/contentSync/tryouts/questionBank";
import type {
  SyncedTryoutCountry,
  SyncedTryoutExam,
  SyncedTryoutSection,
  SyncedTryoutSet,
  SyncedTryoutTrack,
} from "@repo/backend/convex/contentSync/tryouts/spec";
import {
  TRYOUT_CREATED,
  TRYOUT_UNCHANGED,
  TRYOUT_UPDATED,
} from "@repo/backend/convex/contentSync/tryouts/spec";
import { Effect } from "effect";

/** Creates, replaces, or preserves one localized try-out country row. */
export const syncTryoutCountry = Effect.fn("contentSync.tryout.syncCountry")(
  function* (ctx: MutationCtx, country: SyncedTryoutCountry, syncedAt: number) {
    const existing = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutCountries")
        .withIndex("by_countryKey_and_locale", (query) =>
          query
            .eq("countryKey", country.countryKey)
            .eq("locale", country.locale)
        )
        .unique()
    );

    if (hasSameDescribedValues(country, existing)) {
      return TRYOUT_UNCHANGED;
    }

    const nextValues = { ...country, syncedAt };
    if (existing) {
      yield* deleteChangedPublicPathProjection(ctx, existing, nextValues);
      yield* Effect.promise(() =>
        ctx.db.replace("tryoutCountries", existing._id, nextValues)
      );
      return TRYOUT_UPDATED;
    }

    yield* Effect.promise(() => ctx.db.insert("tryoutCountries", nextValues));
    return TRYOUT_CREATED;
  }
);

/** Creates, replaces, or preserves one localized try-out exam row. */
export const syncTryoutExam = Effect.fn("contentSync.tryout.syncExam")(
  function* (ctx: MutationCtx, exam: SyncedTryoutExam, syncedAt: number) {
    const existing = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutExams")
        .withIndex("by_countryKey_and_examKey_and_locale", (query) =>
          query
            .eq("countryKey", exam.countryKey)
            .eq("examKey", exam.examKey)
            .eq("locale", exam.locale)
        )
        .unique()
    );

    if (hasSameDescribedValues(exam, existing)) {
      return TRYOUT_UNCHANGED;
    }

    const nextValues = { ...exam, syncedAt };
    if (existing) {
      yield* deleteChangedPublicPathProjection(ctx, existing, nextValues);
      yield* Effect.promise(() =>
        ctx.db.replace("tryoutExams", existing._id, nextValues)
      );
      return TRYOUT_UPDATED;
    }

    yield* Effect.promise(() => ctx.db.insert("tryoutExams", nextValues));
    return TRYOUT_CREATED;
  }
);

/** Creates, replaces, or preserves one localized try-out set row. */
export const syncTryoutSet = Effect.fn("contentSync.tryout.syncSet")(function* (
  ctx: MutationCtx,
  set: SyncedTryoutSet,
  syncedAt: number
) {
  const existing = yield* Effect.promise(() =>
    ctx.db
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
      .unique()
  );

  if (hasSameSetValues(set, existing)) {
    return TRYOUT_UNCHANGED;
  }

  const nextValues = { ...set, syncedAt };
  if (existing) {
    yield* deleteChangedPublicPathProjection(ctx, existing, nextValues);
    yield* Effect.promise(() =>
      ctx.db.replace("tryoutSets", existing._id, nextValues)
    );
    return TRYOUT_UPDATED;
  }

  yield* Effect.promise(() => ctx.db.insert("tryoutSets", nextValues));
  return TRYOUT_CREATED;
});

/** Creates, replaces, or preserves one localized try-out track row. */
export const syncTryoutTrack = Effect.fn("contentSync.tryout.syncTrack")(
  function* (ctx: MutationCtx, track: SyncedTryoutTrack, syncedAt: number) {
    const existing = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutTracks")
        .withIndex(
          "by_countryKey_and_examKey_and_trackKey_and_locale",
          (query) =>
            query
              .eq("countryKey", track.countryKey)
              .eq("examKey", track.examKey)
              .eq("trackKey", track.trackKey)
              .eq("locale", track.locale)
        )
        .unique()
    );

    if (hasSameDescribedValues(track, existing)) {
      return TRYOUT_UNCHANGED;
    }

    const nextValues = { ...track, syncedAt };
    if (existing) {
      yield* deleteChangedPublicPathProjection(ctx, existing, nextValues);
      yield* Effect.promise(() =>
        ctx.db.replace("tryoutTracks", existing._id, nextValues)
      );
      return TRYOUT_UPDATED;
    }

    yield* Effect.promise(() => ctx.db.insert("tryoutTracks", nextValues));
    return TRYOUT_CREATED;
  }
);

/** Resolves parents and synchronizes one localized try-out section row. */
export const syncTryoutSection = Effect.fn("contentSync.tryout.syncSection")(
  function* (ctx: MutationCtx, section: SyncedTryoutSection, syncedAt: number) {
    const [tryoutSet, questionSet] = yield* Effect.all([
      getTryoutSet(ctx, section),
      getQuestionSet(ctx, {
        locale: section.locale,
        sourcePath: section.questionSourcePath,
      }),
    ]);
    const existing = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutSections")
        .withIndex("by_tryoutSetId_and_sectionKey", (query) =>
          query
            .eq("tryoutSetId", tryoutSet._id)
            .eq("sectionKey", section.sectionKey)
        )
        .unique()
    );
    const nextValues = {
      ...section,
      questionSetId: questionSet._id,
      tryoutSetId: tryoutSet._id,
    };

    if (hasSameSectionValues(nextValues, existing)) {
      return TRYOUT_UNCHANGED;
    }

    const writeValues = { ...nextValues, syncedAt };
    if (existing) {
      yield* deleteChangedPublicPathProjection(ctx, existing, nextValues);
      yield* Effect.promise(() =>
        ctx.db.replace("tryoutSections", existing._id, writeValues)
      );
      return TRYOUT_UPDATED;
    }

    yield* Effect.promise(() => ctx.db.insert("tryoutSections", writeValues));
    return TRYOUT_CREATED;
  }
);

/** Resolves the concrete parent set for one synchronized section. */
export const getTryoutSet = Effect.fn("contentSync.tryout.getSet")(function* (
  ctx: MutationCtx,
  section: Pick<
    SyncedTryoutSection,
    "countryKey" | "examKey" | "locale" | "setKey" | "trackKey"
  >
) {
  const tryoutSet = yield* Effect.promise(() =>
    ctx.db
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
      .unique()
  );

  if (!tryoutSet) {
    return yield* tryoutSyncFail(
      "TRYOUT_SYNC_SET_NOT_FOUND",
      `Missing try-out set ${section.countryKey}/${section.examKey}/${section.trackKey}/${section.setKey}/${section.locale}.`
    );
  }

  return tryoutSet;
});

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
const deleteChangedPublicPathProjection = Effect.fn(
  "contentSync.tryout.deleteChangedProjection"
)(function* (
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
  const publicPath = existing.publicPath;

  yield* Effect.promise(() =>
    deleteContentProjectionsBySourcePath(ctx, {
      locale: existing.locale,
      route: publicPath,
    })
  );
});
