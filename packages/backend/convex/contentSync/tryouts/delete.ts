import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { deleteContentProjectionsBySourcePath } from "@repo/backend/convex/contentSync/lib/syncHelpers";
import { tryoutSyncFail } from "@repo/backend/convex/contentSync/tryouts/error";
import { Effect } from "effect";

/** Deletes one empty, unreferenced question set. */
export const deleteQuestionSet = Effect.fn(
  "contentSync.tryout.deleteQuestionSet"
)(function* (ctx: MutationCtx, questionSetId: Id<"questionSets">) {
  const questions = yield* Effect.promise(() =>
    ctx.db
      .query("questions")
      .withIndex("by_questionSetId_and_number", (query) =>
        query.eq("questionSetId", questionSetId)
      )
      .take(1)
  );

  if (questions.length > 0) {
    return yield* tryoutSyncFail(
      "TRYOUT_SYNC_QUESTION_SET_NOT_EMPTY",
      "Delete stale questions before deleting their question set."
    );
  }

  const sections = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutSections")
      .withIndex("by_questionSetId", (query) =>
        query.eq("questionSetId", questionSetId)
      )
      .take(CONTENT_SYNC_BATCH_LIMITS.tryoutSets + 1)
  );

  if (sections.length > CONTENT_SYNC_BATCH_LIMITS.tryoutSets) {
    return yield* tryoutSyncFail(
      "TRYOUT_SYNC_SECTION_DELETE_LIMIT_EXCEEDED",
      "Question set has too many try-out sections to delete safely."
    );
  }

  if (sections.length > 0) {
    return yield* tryoutSyncFail(
      "TRYOUT_SYNC_QUESTION_SET_HAS_SECTIONS",
      "Delete stale try-out sections before their question set."
    );
  }

  yield* Effect.promise(() => ctx.db.delete("questionSets", questionSetId));
});

/** Deletes one section and its optional public route projection. */
export const deleteTryoutSection = Effect.fn(
  "contentSync.tryout.deleteSection"
)(function* (ctx: MutationCtx, sectionId: Id<"tryoutSections">) {
  const section = yield* Effect.promise(() => ctx.db.get(sectionId));

  if (!section) {
    return 0;
  }

  if (section.publicPath) {
    const publicPath = section.publicPath;
    yield* Effect.promise(() =>
      deleteContentProjectionsBySourcePath(ctx, {
        locale: section.locale,
        route: publicPath,
      })
    );
  }
  yield* Effect.promise(() => ctx.db.delete("tryoutSections", sectionId));
  return 1;
});

/** Deletes one empty set and its public route projection. */
export const deleteTryoutSet = Effect.fn("contentSync.tryout.deleteSet")(
  function* (ctx: MutationCtx, setId: Id<"tryoutSets">) {
    const set = yield* Effect.promise(() => ctx.db.get(setId));

    if (!set) {
      return 0;
    }

    const sections = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutSections")
        .withIndex("by_tryoutSetId_and_order", (query) =>
          query.eq("tryoutSetId", setId)
        )
        .take(CONTENT_SYNC_BATCH_LIMITS.staleTryoutSections + 1)
    );

    if (sections.length > CONTENT_SYNC_BATCH_LIMITS.staleTryoutSections) {
      return yield* tryoutSyncFail(
        "TRYOUT_SYNC_SECTION_DELETE_LIMIT_EXCEEDED",
        "Try-out set has too many sections to delete safely."
      );
    }

    if (sections.length > 0) {
      return yield* tryoutSyncFail(
        "TRYOUT_SYNC_SET_HAS_SECTIONS",
        "Delete stale try-out sections before their set."
      );
    }

    yield* Effect.promise(() =>
      deleteContentProjectionsBySourcePath(ctx, {
        locale: set.locale,
        route: set.publicPath,
      })
    );
    yield* Effect.promise(() => ctx.db.delete("tryoutSets", setId));
    return 1;
  }
);

/** Deletes one empty track and its public route projection. */
export const deleteTryoutTrack = Effect.fn("contentSync.tryout.deleteTrack")(
  function* (ctx: MutationCtx, trackId: Id<"tryoutTracks">) {
    const track = yield* Effect.promise(() => ctx.db.get(trackId));

    if (!track) {
      return 0;
    }

    const sets = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutSets")
        .withIndex("by_track_locale_active_ready_order", (query) =>
          query
            .eq("countryKey", track.countryKey)
            .eq("examKey", track.examKey)
            .eq("trackKey", track.trackKey)
            .eq("locale", track.locale)
        )
        .take(CONTENT_SYNC_BATCH_LIMITS.staleTryoutSets + 1)
    );

    if (sets.length > CONTENT_SYNC_BATCH_LIMITS.staleTryoutSets) {
      return yield* tryoutSyncFail(
        "TRYOUT_SYNC_SET_DELETE_LIMIT_EXCEEDED",
        "Try-out track has too many sets to delete safely."
      );
    }

    if (sets.length > 0) {
      return yield* tryoutSyncFail(
        "TRYOUT_SYNC_TRACK_HAS_SETS",
        "Delete stale try-out sets before their track."
      );
    }

    yield* Effect.promise(() =>
      deleteContentProjectionsBySourcePath(ctx, {
        locale: track.locale,
        route: track.publicPath,
      })
    );
    yield* Effect.promise(() => ctx.db.delete("tryoutTracks", trackId));
    return 1;
  }
);

/** Deletes one empty exam and its public route projection. */
export const deleteTryoutExam = Effect.fn("contentSync.tryout.deleteExam")(
  function* (ctx: MutationCtx, examId: Id<"tryoutExams">) {
    const exam = yield* Effect.promise(() => ctx.db.get(examId));

    if (!exam) {
      return 0;
    }

    const tracks = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutTracks")
        .withIndex(
          "by_countryKey_and_examKey_and_locale_and_isActive_and_order",
          (query) =>
            query
              .eq("countryKey", exam.countryKey)
              .eq("examKey", exam.examKey)
              .eq("locale", exam.locale)
        )
        .take(CONTENT_SYNC_BATCH_LIMITS.staleTryoutTracks + 1)
    );

    if (tracks.length > CONTENT_SYNC_BATCH_LIMITS.staleTryoutTracks) {
      return yield* tryoutSyncFail(
        "TRYOUT_SYNC_TRACK_DELETE_LIMIT_EXCEEDED",
        "Try-out exam has too many tracks to delete safely."
      );
    }

    if (tracks.length > 0) {
      return yield* tryoutSyncFail(
        "TRYOUT_SYNC_EXAM_HAS_TRACKS",
        "Delete stale try-out tracks before their exam."
      );
    }

    yield* Effect.promise(() =>
      deleteContentProjectionsBySourcePath(ctx, {
        locale: exam.locale,
        route: exam.publicPath,
      })
    );
    yield* Effect.promise(() => ctx.db.delete("tryoutExams", examId));
    return 1;
  }
);

/** Deletes one country and its public route projection. */
export const deleteTryoutCountry = Effect.fn(
  "contentSync.tryout.deleteCountry"
)(function* (ctx: MutationCtx, countryId: Id<"tryoutCountries">) {
  const country = yield* Effect.promise(() => ctx.db.get(countryId));

  if (!country) {
    return 0;
  }

  yield* Effect.promise(() =>
    deleteContentProjectionsBySourcePath(ctx, {
      locale: country.locale,
      route: country.publicPath,
    })
  );
  yield* Effect.promise(() => ctx.db.delete("tryoutCountries", countryId));
  return 1;
});
