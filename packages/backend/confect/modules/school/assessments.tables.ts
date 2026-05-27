export * from "./assessmentsTables/authoring";
export * from "./assessmentsTables/delivery";
export * from "./assessmentsTables/imports";
export * from "./assessmentsTables/shared";

import {
  SchoolAssessmentChoices,
  SchoolAssessmentQuestionBankEntries,
  SchoolAssessmentQuestionBanks,
  SchoolAssessmentQuestions,
  SchoolAssessmentRubricCriteria,
  SchoolAssessmentSections,
  SchoolAssessments,
  SchoolAssessmentVersionChoices,
  SchoolAssessmentVersionQuestions,
  SchoolAssessmentVersionRubricCriteria,
  SchoolAssessmentVersionSections,
  SchoolAssessmentVersions,
} from "./assessmentsTables/authoring";
import {
  SchoolAssessmentAssignments,
  SchoolAssessmentAssignmentTargets,
  SchoolAssessmentAttemptEvents,
  SchoolAssessmentAttemptSessions,
  SchoolAssessmentAttempts,
  SchoolAssessmentClassStats,
  SchoolAssessmentEssayGrades,
  SchoolAssessmentFinalGrades,
  SchoolAssessmentFlags,
  SchoolAssessmentLeaderboardEntries,
  SchoolAssessmentQuestionStats,
  SchoolAssessmentResponses,
  SchoolAssessmentSectionAttempts,
  SchoolAssessmentStudentStats,
} from "./assessmentsTables/delivery";
import {
  SchoolAssessmentImportDrafts,
  SchoolAssessmentImportJobs,
} from "./assessmentsTables/imports";

/** All assessment tables registered with the Confect schema. */
export const tables = [
  SchoolAssessments,
  SchoolAssessmentVersions,
  SchoolAssessmentSections,
  SchoolAssessmentVersionSections,
  SchoolAssessmentQuestions,
  SchoolAssessmentVersionQuestions,
  SchoolAssessmentChoices,
  SchoolAssessmentVersionChoices,
  SchoolAssessmentRubricCriteria,
  SchoolAssessmentVersionRubricCriteria,
  SchoolAssessmentQuestionBanks,
  SchoolAssessmentQuestionBankEntries,
  SchoolAssessmentAssignments,
  SchoolAssessmentAssignmentTargets,
  SchoolAssessmentAttempts,
  SchoolAssessmentSectionAttempts,
  SchoolAssessmentResponses,
  SchoolAssessmentEssayGrades,
  SchoolAssessmentFinalGrades,
  SchoolAssessmentAttemptSessions,
  SchoolAssessmentAttemptEvents,
  SchoolAssessmentFlags,
  SchoolAssessmentStudentStats,
  SchoolAssessmentQuestionStats,
  SchoolAssessmentClassStats,
  SchoolAssessmentLeaderboardEntries,
  SchoolAssessmentImportJobs,
  SchoolAssessmentImportDrafts,
] as const;
