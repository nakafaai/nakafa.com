import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { tryUserCleanup } from "@repo/backend/convex/auth/cleanup/spec";
import { Effect } from "effect";

const CHILD_BATCH_SIZE = 50;
const RESULT_BATCH_SIZE = 25;
const IMPORT_DRAFT_BATCH_SIZE = 25;

/** Deletes one bounded child-table phase for an assessment attempt. */
const cleanupAttemptChildren = Effect.fn(
  "auth.cleanup.cleanupAssessmentAttemptChildren"
)(function* (ctx: MutationCtx, attempt: Doc<"schoolAssessmentAttempts">) {
  const essayGrades = yield* tryUserCleanup(() =>
    ctx.db
      .query("schoolAssessmentEssayGrades")
      .withIndex("by_attemptId", (query) => query.eq("attemptId", attempt._id))
      .take(CHILD_BATCH_SIZE)
  );

  for (const grade of essayGrades) {
    yield* tryUserCleanup(() =>
      ctx.db.delete("schoolAssessmentEssayGrades", grade._id)
    );
  }

  if (essayGrades.length === CHILD_BATCH_SIZE) {
    return true;
  }

  const responses = yield* tryUserCleanup(() =>
    ctx.db
      .query("schoolAssessmentResponses")
      .withIndex("by_attemptId_and_questionId", (query) =>
        query.eq("attemptId", attempt._id)
      )
      .take(CHILD_BATCH_SIZE)
  );

  for (const response of responses) {
    for (const storageId of response.essayAttachmentStorageIds ?? []) {
      yield* tryUserCleanup(() => ctx.storage.delete(storageId));
    }

    yield* tryUserCleanup(() =>
      ctx.db.delete("schoolAssessmentResponses", response._id)
    );
  }

  if (responses.length === CHILD_BATCH_SIZE) {
    return true;
  }

  const sectionAttempts = yield* tryUserCleanup(() =>
    ctx.db
      .query("schoolAssessmentSectionAttempts")
      .withIndex("by_attemptId_and_sectionId", (query) =>
        query.eq("attemptId", attempt._id)
      )
      .take(CHILD_BATCH_SIZE)
  );

  for (const sectionAttempt of sectionAttempts) {
    yield* tryUserCleanup(() =>
      ctx.db.delete("schoolAssessmentSectionAttempts", sectionAttempt._id)
    );
  }

  if (sectionAttempts.length === CHILD_BATCH_SIZE) {
    return true;
  }

  const sessions = yield* tryUserCleanup(() =>
    ctx.db
      .query("schoolAssessmentAttemptSessions")
      .withIndex("by_attemptId", (query) => query.eq("attemptId", attempt._id))
      .take(CHILD_BATCH_SIZE)
  );

  for (const session of sessions) {
    yield* tryUserCleanup(() =>
      ctx.db.delete("schoolAssessmentAttemptSessions", session._id)
    );
  }

  if (sessions.length === CHILD_BATCH_SIZE) {
    return true;
  }

  const events = yield* tryUserCleanup(() =>
    ctx.db
      .query("schoolAssessmentAttemptEvents")
      .withIndex("by_attemptId_and_occurredAt", (query) =>
        query.eq("attemptId", attempt._id)
      )
      .take(CHILD_BATCH_SIZE)
  );

  for (const event of events) {
    yield* tryUserCleanup(() =>
      ctx.db.delete("schoolAssessmentAttemptEvents", event._id)
    );
  }

  if (events.length === CHILD_BATCH_SIZE) {
    return true;
  }

  const flags = yield* tryUserCleanup(() =>
    ctx.db
      .query("schoolAssessmentFlags")
      .withIndex("by_attemptId", (query) => query.eq("attemptId", attempt._id))
      .take(CHILD_BATCH_SIZE)
  );

  for (const flag of flags) {
    yield* tryUserCleanup(() =>
      ctx.db.delete("schoolAssessmentFlags", flag._id)
    );
  }

  return flags.length === CHILD_BATCH_SIZE;
});

/** Deletes one assessment attempt after its dependent rows are gone. */
const cleanupAssessmentAttempt = Effect.fn(
  "auth.cleanup.cleanupAssessmentAttempt"
)(function* (ctx: MutationCtx, userId: Id<"users">) {
  const attempt = yield* tryUserCleanup(() =>
    ctx.db
      .query("schoolAssessmentAttempts")
      .withIndex("by_studentId_and_assignmentId", (query) =>
        query.eq("studentId", userId)
      )
      .first()
  );

  if (!attempt) {
    return false;
  }

  if (yield* cleanupAttemptChildren(ctx, attempt)) {
    return true;
  }

  yield* tryUserCleanup(() =>
    ctx.db.delete("schoolAssessmentAttempts", attempt._id)
  );

  return true;
});

/** Deletes one bounded batch of durable assessment result rows. */
const cleanupAssessmentResults = Effect.fn(
  "auth.cleanup.cleanupAssessmentResults"
)(function* (ctx: MutationCtx, userId: Id<"users">) {
  const finalGrades = yield* tryUserCleanup(() =>
    ctx.db
      .query("schoolAssessmentFinalGrades")
      .withIndex("by_studentId", (query) => query.eq("studentId", userId))
      .take(RESULT_BATCH_SIZE)
  );

  for (const grade of finalGrades) {
    yield* tryUserCleanup(() =>
      ctx.db.delete("schoolAssessmentFinalGrades", grade._id)
    );
  }

  if (finalGrades.length === RESULT_BATCH_SIZE) {
    return true;
  }

  const studentStats = yield* tryUserCleanup(() =>
    ctx.db
      .query("schoolAssessmentStudentStats")
      .withIndex("by_studentId", (query) => query.eq("studentId", userId))
      .take(RESULT_BATCH_SIZE)
  );

  for (const stats of studentStats) {
    yield* tryUserCleanup(() =>
      ctx.db.delete("schoolAssessmentStudentStats", stats._id)
    );
  }

  if (studentStats.length === RESULT_BATCH_SIZE) {
    return true;
  }

  const leaderboardRows = yield* tryUserCleanup(() =>
    ctx.db
      .query("schoolAssessmentLeaderboardEntries")
      .withIndex("by_studentId", (query) => query.eq("studentId", userId))
      .take(RESULT_BATCH_SIZE)
  );

  for (const row of leaderboardRows) {
    yield* tryUserCleanup(() =>
      ctx.db.delete("schoolAssessmentLeaderboardEntries", row._id)
    );
  }

  return leaderboardRows.length === RESULT_BATCH_SIZE;
});

/** Deletes one user-created assessment import and its source file. */
const cleanupAssessmentImport = Effect.fn(
  "auth.cleanup.cleanupAssessmentImport"
)(function* (ctx: MutationCtx, userId: Id<"users">) {
  const job = yield* tryUserCleanup(() =>
    ctx.db
      .query("schoolAssessmentImportJobs")
      .withIndex("by_createdBy_and_status", (query) =>
        query.eq("createdBy", userId)
      )
      .first()
  );

  if (!job) {
    return false;
  }

  const drafts = yield* tryUserCleanup(() =>
    ctx.db
      .query("schoolAssessmentImportDrafts")
      .withIndex("by_importJobId", (query) => query.eq("importJobId", job._id))
      .take(IMPORT_DRAFT_BATCH_SIZE)
  );

  for (const draft of drafts) {
    yield* tryUserCleanup(() =>
      ctx.db.delete("schoolAssessmentImportDrafts", draft._id)
    );
  }

  if (drafts.length === IMPORT_DRAFT_BATCH_SIZE) {
    return true;
  }

  const sourceStorageId = job.sourceStorageId;

  if (sourceStorageId) {
    yield* tryUserCleanup(() => ctx.storage.delete(sourceStorageId));
  }

  yield* tryUserCleanup(() =>
    ctx.db.delete("schoolAssessmentImportJobs", job._id)
  );

  return true;
});

/** Deletes one bounded batch of personal assessment data. */
export const cleanupUserAssessmentData = Effect.fn(
  "auth.cleanup.cleanupUserAssessmentData"
)(function* (ctx: MutationCtx, userId: Id<"users">) {
  if (yield* cleanupAssessmentAttempt(ctx, userId)) {
    return true;
  }

  if (yield* cleanupAssessmentResults(ctx, userId)) {
    return true;
  }

  return yield* cleanupAssessmentImport(ctx, userId);
});
