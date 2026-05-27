import type { Id } from "@repo/backend/confect/_generated/dataModel";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth.service";
import { AssessmentError } from "@repo/backend/confect/modules/school/assessments.errors";
import { requireAssessment } from "@repo/backend/confect/modules/school/assessments.shared";
import { requirePermission } from "@repo/backend/confect/modules/school/classAccess.service";
import { PERMISSIONS } from "@repo/backend/confect/modules/school/permissions";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { Effect } from "effect";

/** Deletes an unassigned assessment and all authoring/version rows. */
export const deleteAssessment = Effect.fn("assessments.deleteAssessment")(
  function* (args: {
    readonly assessmentId: Id<"schoolAssessments">;
    readonly schoolId: Id<"schools">;
  }) {
    const ctx = yield* MutationCtx;
    const user = yield* requireAppUser(ctx);
    const assessment = yield* requireAssessment(
      ctx,
      args.schoolId,
      args.assessmentId
    );

    yield* requirePermission(ctx, PERMISSIONS.ASSESSMENT_DELETE, {
      classId: assessment.classId,
      schoolId: assessment.schoolId,
      userId: user.appUser._id,
    });

    const assignments = yield* Effect.promise(() =>
      ctx.db
        .query("schoolAssessmentAssignments")
        .withIndex("by_assessmentId_and_status", (query) =>
          query.eq("assessmentId", args.assessmentId)
        )
        .collect()
    );

    if (assignments.length > 0) {
      return yield* Effect.fail(
        new AssessmentError({
          code: "ASSESSMENT_DELETE_BLOCKED",
          message: "Assigned assessments must be archived instead of deleted.",
        })
      );
    }

    const currentScheduledJobId = assessment.scheduledJobId;

    if (assessment.status === "scheduled" && currentScheduledJobId) {
      yield* Effect.promise(() => ctx.scheduler.cancel(currentScheduledJobId));
    }

    yield* deleteAssessmentTree(ctx, args.assessmentId);
    yield* Effect.promise(() => ctx.db.delete(args.assessmentId));

    return null;
  }
);

/** Deletes all nested rows that belong only to an assessment draft. */
const deleteAssessmentTree = Effect.fn("assessments.deleteTree")(function* (
  ctx: ConvexMutationCtx,
  assessmentId: Id<"schoolAssessments">
) {
  const versions = yield* Effect.promise(() =>
    ctx.db
      .query("schoolAssessmentVersions")
      .withIndex("by_assessmentId_and_versionNumber", (query) =>
        query.eq("assessmentId", assessmentId)
      )
      .collect()
  );
  const sections = yield* Effect.promise(() =>
    ctx.db
      .query("schoolAssessmentSections")
      .withIndex("by_assessmentId_and_order", (query) =>
        query.eq("assessmentId", assessmentId)
      )
      .collect()
  );
  const questions = yield* Effect.promise(() =>
    ctx.db
      .query("schoolAssessmentQuestions")
      .withIndex("by_assessmentId_and_sectionId_and_order", (query) =>
        query.eq("assessmentId", assessmentId)
      )
      .collect()
  );
  const versionSections = yield* Effect.promise(() =>
    ctx.db
      .query("schoolAssessmentVersionSections")
      .withIndex("by_assessmentId_and_versionId_and_order", (query) =>
        query.eq("assessmentId", assessmentId)
      )
      .collect()
  );
  const versionQuestions = yield* Effect.promise(() =>
    ctx.db
      .query("schoolAssessmentVersionQuestions")
      .withIndex(
        "by_assessmentId_and_versionId_and_sectionId_and_order",
        (query) => query.eq("assessmentId", assessmentId)
      )
      .collect()
  );
  const choices = yield* Effect.promise(() =>
    ctx.db
      .query("schoolAssessmentChoices")
      .withIndex("by_assessmentId_and_questionId_and_order", (query) =>
        query.eq("assessmentId", assessmentId)
      )
      .collect()
  );
  const versionChoices = yield* Effect.promise(() =>
    ctx.db
      .query("schoolAssessmentVersionChoices")
      .withIndex("by_assessmentId_and_questionId_and_order", (query) =>
        query.eq("assessmentId", assessmentId)
      )
      .collect()
  );
  const rubricCriteria = yield* Effect.promise(() =>
    ctx.db
      .query("schoolAssessmentRubricCriteria")
      .withIndex("by_assessmentId_and_questionId_and_order", (query) =>
        query.eq("assessmentId", assessmentId)
      )
      .collect()
  );
  const versionRubricCriteria = yield* Effect.promise(() =>
    ctx.db
      .query("schoolAssessmentVersionRubricCriteria")
      .withIndex("by_assessmentId_and_questionId_and_order", (query) =>
        query.eq("assessmentId", assessmentId)
      )
      .collect()
  );

  for (const choice of choices) {
    yield* Effect.promise(() => ctx.db.delete(choice._id));
  }

  for (const choice of versionChoices) {
    yield* Effect.promise(() => ctx.db.delete(choice._id));
  }

  for (const criterion of rubricCriteria) {
    yield* Effect.promise(() => ctx.db.delete(criterion._id));
  }

  for (const criterion of versionRubricCriteria) {
    yield* Effect.promise(() => ctx.db.delete(criterion._id));
  }

  for (const question of questions) {
    yield* Effect.promise(() => ctx.db.delete(question._id));
  }

  for (const question of versionQuestions) {
    yield* Effect.promise(() => ctx.db.delete(question._id));
  }

  for (const section of sections) {
    yield* Effect.promise(() => ctx.db.delete(section._id));
  }

  for (const section of versionSections) {
    yield* Effect.promise(() => ctx.db.delete(section._id));
  }

  for (const version of versions) {
    yield* Effect.promise(() => ctx.db.delete(version._id));
  }
});
