import type { Id } from "@repo/backend/confect/_generated/dataModel";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth/session.service";
import { AssessmentError } from "@repo/backend/confect/modules/school/assessments.errors";
import { requireAssessment } from "@repo/backend/confect/modules/school/assessments.shared";
import { requirePermission } from "@repo/backend/confect/modules/school/classAccess.service";
import { PERMISSIONS } from "@repo/backend/confect/modules/school/permissions";
import { Effect } from "effect";

/** Deletes an unassigned assessment and all authoring/version rows. */
export const deleteAssessment = Effect.fnUntraced(function* (args: {
  readonly assessmentId: Id<"schoolAssessments">;
  readonly schoolId: Id<"schools">;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const user = yield* requireAppUser();
  const assessment = yield* requireAssessment(args.schoolId, args.assessmentId);

  yield* requirePermission(PERMISSIONS.ASSESSMENT_DELETE, {
    classId: assessment.classId,
    schoolId: assessment.schoolId,
    userId: user.appUser._id,
  });

  const assignments = yield* reader
    .table("schoolAssessmentAssignments")
    .index("by_assessmentId_and_status", (query) =>
      query.eq("assessmentId", args.assessmentId)
    )
    .collect();

  if (assignments.length > 0) {
    return yield* Effect.fail(
      new AssessmentError({
        code: "ASSESSMENT_DELETE_BLOCKED",
        message: "Assigned assessments must be archived instead of deleted.",
      })
    );
  }

  yield* deleteAssessmentTree(args.assessmentId);
  yield* writer.table("schoolAssessments").delete(args.assessmentId);

  return null;
});

/** Deletes all nested rows that belong only to an assessment draft. */
const deleteAssessmentTree = Effect.fnUntraced(function* (
  assessmentId: Id<"schoolAssessments">
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const versions = yield* reader
    .table("schoolAssessmentVersions")
    .index("by_assessmentId_and_versionNumber", (query) =>
      query.eq("assessmentId", assessmentId)
    )
    .collect();
  const sections = yield* reader
    .table("schoolAssessmentSections")
    .index("by_assessmentId_and_order", (query) =>
      query.eq("assessmentId", assessmentId)
    )
    .collect();
  const questions = yield* reader
    .table("schoolAssessmentQuestions")
    .index("by_assessmentId_and_sectionId_and_order", (query) =>
      query.eq("assessmentId", assessmentId)
    )
    .collect();
  const versionSections = yield* reader
    .table("schoolAssessmentVersionSections")
    .index("by_assessmentId_and_versionId_and_order", (query) =>
      query.eq("assessmentId", assessmentId)
    )
    .collect();
  const versionQuestions = yield* reader
    .table("schoolAssessmentVersionQuestions")
    .index("by_assessmentId_and_versionId_and_sectionId_and_order", (query) =>
      query.eq("assessmentId", assessmentId)
    )
    .collect();
  const choices = yield* reader
    .table("schoolAssessmentChoices")
    .index("by_assessmentId_and_questionId_and_order", (query) =>
      query.eq("assessmentId", assessmentId)
    )
    .collect();
  const versionChoices = yield* reader
    .table("schoolAssessmentVersionChoices")
    .index("by_assessmentId_and_questionId_and_order", (query) =>
      query.eq("assessmentId", assessmentId)
    )
    .collect();
  const rubricCriteria = yield* reader
    .table("schoolAssessmentRubricCriteria")
    .index("by_assessmentId_and_questionId_and_order", (query) =>
      query.eq("assessmentId", assessmentId)
    )
    .collect();
  const versionRubricCriteria = yield* reader
    .table("schoolAssessmentVersionRubricCriteria")
    .index("by_assessmentId_and_questionId_and_order", (query) =>
      query.eq("assessmentId", assessmentId)
    )
    .collect();

  for (const choice of choices) {
    yield* writer.table("schoolAssessmentChoices").delete(choice._id);
  }

  for (const choice of versionChoices) {
    yield* writer.table("schoolAssessmentVersionChoices").delete(choice._id);
  }

  for (const criterion of rubricCriteria) {
    yield* writer.table("schoolAssessmentRubricCriteria").delete(criterion._id);
  }

  for (const criterion of versionRubricCriteria) {
    yield* writer
      .table("schoolAssessmentVersionRubricCriteria")
      .delete(criterion._id);
  }

  for (const question of questions) {
    yield* writer.table("schoolAssessmentQuestions").delete(question._id);
  }

  for (const question of versionQuestions) {
    yield* writer
      .table("schoolAssessmentVersionQuestions")
      .delete(question._id);
  }

  for (const section of sections) {
    yield* writer.table("schoolAssessmentSections").delete(section._id);
  }

  for (const section of versionSections) {
    yield* writer.table("schoolAssessmentVersionSections").delete(section._id);
  }

  for (const version of versions) {
    yield* writer.table("schoolAssessmentVersions").delete(version._id);
  }
});
