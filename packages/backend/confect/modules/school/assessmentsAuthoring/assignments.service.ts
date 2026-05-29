import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth/session.service";
import { AssessmentError } from "@repo/backend/confect/modules/school/assessments.errors";
import { requireAssessment } from "@repo/backend/confect/modules/school/assessments.shared";
import {
  loadActiveClass,
  requirePermission,
} from "@repo/backend/confect/modules/school/classAccess.service";
import { PERMISSIONS } from "@repo/backend/confect/modules/school/permissions";
import { Clock, Effect } from "effect";

/** Creates a class-targeted assignment from an assessment version. */
export const createAssignment = Effect.fnUntraced(function* (args: {
  readonly assessmentId: Id<"schoolAssessments">;
  readonly classIds: readonly Id<"schoolClasses">[];
  readonly closesAt?: number;
  readonly gradingMode: Doc<"schoolAssessmentAssignments">["gradingMode"];
  readonly monitoringMode: Doc<"schoolAssessmentAssignments">["monitoringMode"];
  readonly opensAt?: number;
  readonly rankingScope: Doc<"schoolAssessmentAssignments">["rankingScope"];
  readonly releaseMode: Doc<"schoolAssessmentAssignments">["releaseMode"];
  readonly releasesAt?: number;
  readonly retakePolicy: Doc<"schoolAssessmentAssignments">["retakePolicy"];
  readonly schoolId: Id<"schools">;
  readonly timingPolicy: Doc<"schoolAssessmentAssignments">["timingPolicy"];
  readonly title: string;
  readonly versionId: Id<"schoolAssessmentVersions">;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const user = yield* requireAppUser();

  if (args.classIds.length === 0) {
    return yield* Effect.fail(
      new AssessmentError({
        code: "ASSIGNMENT_TARGET_REQUIRED",
        message: "Select at least one class target.",
      })
    );
  }

  const assessment = yield* requireAssessment(args.schoolId, args.assessmentId);

  yield* requirePermission(PERMISSIONS.ASSESSMENT_PUBLISH, {
    classId: assessment.classId,
    schoolId: assessment.schoolId,
    userId: user.appUser._id,
  });

  const version = yield* reader
    .table("schoolAssessmentVersions")
    .get(args.versionId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (
    !version ||
    version.assessmentId !== assessment._id ||
    version.schoolId !== assessment.schoolId
  ) {
    return yield* Effect.fail(
      new AssessmentError({
        code: "ASSESSMENT_VERSION_NOT_FOUND",
        message: "Assessment version not found for this assessment.",
      })
    );
  }

  const targetIds = new Set(args.classIds);

  if (targetIds.size !== args.classIds.length) {
    return yield* Effect.fail(
      new AssessmentError({
        code: "DUPLICATE_CLASS_TARGET",
        message: "Each class can only be assigned once.",
      })
    );
  }

  const targetClasses = yield* Effect.all(
    args.classIds.map((classId) => loadActiveClass(classId))
  );

  if (
    targetClasses.some(
      (classData) => classData.schoolId !== assessment.schoolId
    )
  ) {
    return yield* Effect.fail(
      new AssessmentError({
        code: "CLASS_NOT_FOUND",
        message: "Class not found in this school.",
      })
    );
  }

  const now = yield* Clock.currentTimeMillis;
  const assignmentId = yield* writer
    .table("schoolAssessmentAssignments")
    .insert({
      assessmentId: args.assessmentId,
      closesAt: args.closesAt,
      createdBy: user.appUser._id,
      gradingMode: args.gradingMode,
      monitoringMode: args.monitoringMode,
      opensAt: args.opensAt,
      publishedAt: args.opensAt ? undefined : now,
      rankingScope: args.rankingScope,
      releaseMode: args.releaseMode,
      releasesAt: args.releasesAt,
      retakePolicy: args.retakePolicy,
      schoolId: args.schoolId,
      status: args.opensAt ? "scheduled" : "published",
      timingPolicy: args.timingPolicy,
      title: args.title,
      updatedAt: now,
      updatedBy: user.appUser._id,
      versionId: version._id,
    });

  for (const classId of args.classIds) {
    yield* writer.table("schoolAssessmentAssignmentTargets").insert({
      assignmentId,
      classId,
      schoolId: args.schoolId,
    });
  }

  return assignmentId;
});
