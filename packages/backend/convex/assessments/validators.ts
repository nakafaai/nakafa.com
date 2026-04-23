import { richContentValidator } from "@repo/backend/convex/assessments/schema";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";
import { nullable } from "convex-helpers/validators";

/** Return shape for one full authored assessment editor payload. */
export const authoredAssessmentValidator = v.object({
  assessment: vv.doc("schoolAssessments"),
  currentVersion: nullable(vv.doc("schoolAssessmentVersions")),
  sections: v.array(vv.doc("schoolAssessmentSections")),
  questions: v.array(vv.doc("schoolAssessmentQuestions")),
  choices: v.array(vv.doc("schoolAssessmentChoices")),
  rubricCriteria: v.array(vv.doc("schoolAssessmentRubricCriteria")),
});

/** Return shape for created question bank payloads. */
export const questionBankWithEntriesValidator = v.object({
  bank: vv.doc("schoolAssessmentQuestionBanks"),
  entries: v.array(vv.doc("schoolAssessmentQuestionBankEntries")),
});

/** Arguments for creating authored sections with initial ordering. */
export const createSectionArgsValidator = v.object({
  title: v.string(),
  description: v.optional(richContentValidator),
  durationMinutes: v.optional(v.number()),
});

/** Arguments for authored question creation. */
export const createQuestionArgsValidator = v.object({
  questionType: v.union(
    v.literal("mcq-single"),
    v.literal("mcq-multi"),
    v.literal("essay")
  ),
  stem: richContentValidator,
  explanation: v.optional(richContentValidator),
  points: v.number(),
  required: v.boolean(),
  shuffleChoices: v.boolean(),
  maxSelectionCount: v.optional(v.number()),
});

/** Public authored list and entity validators. */
export {
  paginatedSchoolAssessmentsValidator,
  schoolAssessmentAssignmentTargetValidator,
  schoolAssessmentAssignmentValidator,
  schoolAssessmentChoiceValidator,
  schoolAssessmentQuestionBankEntryValidator,
  schoolAssessmentQuestionBankValidator,
  schoolAssessmentQuestionValidator,
  schoolAssessmentRubricCriterionValidator,
  schoolAssessmentSectionValidator,
  schoolAssessmentValidator,
  schoolAssessmentVersionValidator,
} from "@repo/backend/convex/assessments/schema";
