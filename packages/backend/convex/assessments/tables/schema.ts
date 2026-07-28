import {
  schoolAssessmentClassStatValidator,
  schoolAssessmentLeaderboardEntryValidator,
  schoolAssessmentQuestionStatValidator,
  schoolAssessmentStudentStatValidator,
} from "@repo/backend/convex/assessments/analytics/schema";
import {
  schoolAssessmentImportDraftValidator,
  schoolAssessmentImportJobValidator,
} from "@repo/backend/convex/assessments/imports/schema";
import {
  schoolAssessmentAttemptEventValidator,
  schoolAssessmentAttemptSessionValidator,
  schoolAssessmentFlagValidator,
} from "@repo/backend/convex/assessments/monitoring/schema";
import {
  schoolAssessmentAssignmentTargetValidator,
  schoolAssessmentAssignmentValidator,
  schoolAssessmentAttemptValidator,
  schoolAssessmentChoiceValidator,
  schoolAssessmentEssayGradeValidator,
  schoolAssessmentFinalGradeValidator,
  schoolAssessmentQuestionBankEntryValidator,
  schoolAssessmentQuestionBankValidator,
  schoolAssessmentQuestionValidator,
  schoolAssessmentResponseValidator,
  schoolAssessmentRubricCriterionValidator,
  schoolAssessmentSectionAttemptValidator,
  schoolAssessmentSectionValidator,
  schoolAssessmentValidator,
  schoolAssessmentVersionChoiceValidator,
  schoolAssessmentVersionQuestionValidator,
  schoolAssessmentVersionRubricCriterionValidator,
  schoolAssessmentVersionSectionValidator,
  schoolAssessmentVersionValidator,
} from "@repo/backend/convex/assessments/schema";
import { defineTable } from "convex/server";

const tables = {
  schoolAssessments: defineTable(schoolAssessmentValidator)
    .index("by_schoolId_and_status", ["schoolId", "status"])
    .index("by_schoolId_and_slug", ["schoolId", "slug"])
    .index("by_schoolId_and_classId_and_status", [
      "schoolId",
      "classId",
      "status",
    ])
    .index("by_schoolId_and_classId_and_status_and_order", [
      "schoolId",
      "classId",
      "status",
      "order",
    ])
    .index("by_schoolId_and_classId_and_order", [
      "schoolId",
      "classId",
      "order",
    ])
    .index("by_schoolId_and_order", ["schoolId", "order"])
    .index("by_schoolId_and_updatedAt", ["schoolId", "updatedAt"])
    .index("by_schoolId_and_classId_and_updatedAt", [
      "schoolId",
      "classId",
      "updatedAt",
    ]),
  schoolAssessmentVersions: defineTable(schoolAssessmentVersionValidator).index(
    "by_assessmentId_and_versionNumber",
    ["assessmentId", "versionNumber"]
  ),
  schoolAssessmentSections: defineTable(schoolAssessmentSectionValidator).index(
    "by_assessmentId_and_order",
    ["assessmentId", "order"]
  ),
  schoolAssessmentVersionSections: defineTable(
    schoolAssessmentVersionSectionValidator
  )
    .index("by_versionId_and_order", ["versionId", "order"])
    .index("by_assessmentId_and_versionId_and_order", [
      "assessmentId",
      "versionId",
      "order",
    ]),
  schoolAssessmentQuestions: defineTable(schoolAssessmentQuestionValidator)
    .index("by_assessmentId_and_sectionId_and_order", [
      "assessmentId",
      "sectionId",
      "order",
    ])
    .index("by_bankEntryId", ["bankEntryId"]),
  schoolAssessmentVersionQuestions: defineTable(
    schoolAssessmentVersionQuestionValidator
  )
    .index("by_versionId_and_sectionId_and_order", [
      "versionId",
      "sectionId",
      "order",
    ])
    .index("by_assessmentId_and_versionId_and_sectionId_and_order", [
      "assessmentId",
      "versionId",
      "sectionId",
      "order",
    ])
    .index("by_sourceQuestionId", ["sourceQuestionId"]),
  schoolAssessmentChoices: defineTable(schoolAssessmentChoiceValidator)
    .index("by_questionId_and_order", ["questionId", "order"])
    .index("by_assessmentId_and_questionId_and_order", [
      "assessmentId",
      "questionId",
      "order",
    ]),
  schoolAssessmentVersionChoices: defineTable(
    schoolAssessmentVersionChoiceValidator
  )
    .index("by_questionId_and_order", ["questionId", "order"])
    .index("by_assessmentId_and_questionId_and_order", [
      "assessmentId",
      "questionId",
      "order",
    ]),
  schoolAssessmentRubricCriteria: defineTable(
    schoolAssessmentRubricCriterionValidator
  )
    .index("by_questionId_and_order", ["questionId", "order"])
    .index("by_assessmentId_and_questionId_and_order", [
      "assessmentId",
      "questionId",
      "order",
    ]),
  schoolAssessmentVersionRubricCriteria: defineTable(
    schoolAssessmentVersionRubricCriterionValidator
  )
    .index("by_questionId_and_order", ["questionId", "order"])
    .index("by_assessmentId_and_questionId_and_order", [
      "assessmentId",
      "questionId",
      "order",
    ]),
  schoolAssessmentQuestionBanks: defineTable(
    schoolAssessmentQuestionBankValidator
  )
    .index("by_schoolId_and_scope", ["schoolId", "scope"])
    .index("by_schoolId_and_classId", ["schoolId", "classId"]),
  schoolAssessmentQuestionBankEntries: defineTable(
    schoolAssessmentQuestionBankEntryValidator
  )
    .index("by_bankId", ["bankId"])
    .index("by_schoolId_and_classId", ["schoolId", "classId"]),
  schoolAssessmentAssignments: defineTable(schoolAssessmentAssignmentValidator)
    .index("by_assessmentId_and_status", ["assessmentId", "status"])
    .index("by_schoolId_and_status", ["schoolId", "status"]),
  schoolAssessmentAssignmentTargets: defineTable(
    schoolAssessmentAssignmentTargetValidator
  )
    .index("by_assignmentId_and_classId", ["assignmentId", "classId"])
    .index("by_classId_and_assignmentId", ["classId", "assignmentId"]),
  schoolAssessmentAttempts: defineTable(schoolAssessmentAttemptValidator)
    .index("by_assignmentId_and_studentId_and_attemptNumber", [
      "assignmentId",
      "studentId",
      "attemptNumber",
    ])
    .index("by_assignmentId_and_studentId_and_status", [
      "assignmentId",
      "studentId",
      "status",
    ])
    .index("by_assignmentId_and_status", ["assignmentId", "status"])
    .index("by_studentId_and_assignmentId", ["studentId", "assignmentId"]),
  schoolAssessmentSectionAttempts: defineTable(
    schoolAssessmentSectionAttemptValidator
  ).index("by_attemptId_and_sectionId", ["attemptId", "sectionId"]),
  schoolAssessmentResponses: defineTable(schoolAssessmentResponseValidator)
    .index("by_attemptId_and_questionId", ["attemptId", "questionId"])
    .index("by_questionId", ["questionId"]),
  schoolAssessmentEssayGrades: defineTable(schoolAssessmentEssayGradeValidator)
    .index("by_responseId", ["responseId"])
    .index("by_attemptId", ["attemptId"]),
  schoolAssessmentFinalGrades: defineTable(schoolAssessmentFinalGradeValidator)
    .index("by_assignmentId_and_studentId", ["assignmentId", "studentId"])
    .index("by_studentId", ["studentId"]),
  schoolAssessmentAttemptSessions: defineTable(
    schoolAssessmentAttemptSessionValidator
  )
    .index("by_attemptId", ["attemptId"])
    .index("by_assignmentId_and_status", ["assignmentId", "status"]),
  schoolAssessmentAttemptEvents: defineTable(
    schoolAssessmentAttemptEventValidator
  )
    .index("by_attemptId_and_occurredAt", ["attemptId", "occurredAt"])
    .index("by_assignmentId_and_occurredAt", ["assignmentId", "occurredAt"]),
  schoolAssessmentFlags: defineTable(schoolAssessmentFlagValidator)
    .index("by_assignmentId_and_reviewStatus", ["assignmentId", "reviewStatus"])
    .index("by_attemptId", ["attemptId"]),
  schoolAssessmentStudentStats: defineTable(
    schoolAssessmentStudentStatValidator
  )
    .index("by_assignmentId_and_studentId", ["assignmentId", "studentId"])
    .index("by_studentId", ["studentId"]),
  schoolAssessmentQuestionStats: defineTable(
    schoolAssessmentQuestionStatValidator
  ).index("by_assignmentId_and_questionId", ["assignmentId", "questionId"]),
  schoolAssessmentClassStats: defineTable(
    schoolAssessmentClassStatValidator
  ).index("by_assignmentId_and_classId", ["assignmentId", "classId"]),
  schoolAssessmentLeaderboardEntries: defineTable(
    schoolAssessmentLeaderboardEntryValidator
  )
    .index("by_assignmentId_and_rankingScope_and_rank", [
      "assignmentId",
      "rankingScope",
      "rank",
    ])
    .index("by_assignmentId_and_studentId", ["assignmentId", "studentId"])
    .index("by_studentId", ["studentId"]),
  schoolAssessmentImportJobs: defineTable(schoolAssessmentImportJobValidator)
    .index("by_schoolId_and_status", ["schoolId", "status"])
    .index("by_createdBy_and_status", ["createdBy", "status"]),
  schoolAssessmentImportDrafts: defineTable(
    schoolAssessmentImportDraftValidator
  ).index("by_importJobId", ["importJobId"]),
};

export default tables;
