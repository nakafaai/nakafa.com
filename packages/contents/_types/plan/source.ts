import type { PlanSource } from "@repo/contents/_types/plan/schema";
import { PlanSourceSchema } from "@repo/contents/_types/plan/schema";
import { exercisesHighSchoolSnbtEnglishLanguagePlan } from "@repo/contents/_types/plan/source/exercises/high-school/snbt/english-language";
import { exercisesHighSchoolSnbtGeneralKnowledgePlan } from "@repo/contents/_types/plan/source/exercises/high-school/snbt/general-knowledge";
import { exercisesHighSchoolSnbtGeneralReasoningPlan } from "@repo/contents/_types/plan/source/exercises/high-school/snbt/general-reasoning";
import { exercisesHighSchoolSnbtIndonesianLanguagePlan } from "@repo/contents/_types/plan/source/exercises/high-school/snbt/indonesian-language";
import { exercisesHighSchoolSnbtMathematicalReasoningPlan } from "@repo/contents/_types/plan/source/exercises/high-school/snbt/mathematical-reasoning";
import { exercisesHighSchoolSnbtQuantitativeKnowledgePlan } from "@repo/contents/_types/plan/source/exercises/high-school/snbt/quantitative-knowledge";
import { exercisesHighSchoolSnbtReadingAndWritingSkillsPlan } from "@repo/contents/_types/plan/source/exercises/high-school/snbt/reading-and-writing-skills";
import { exercisesHighSchoolTkaMathematicsPlan } from "@repo/contents/_types/plan/source/exercises/high-school/tka/mathematics";
import { exercisesMiddleSchoolGrade9MathematicsPlan } from "@repo/contents/_types/plan/source/exercises/middle-school/grade-9/mathematics";
import { subjectHighSchool10BiologyPlan } from "@repo/contents/_types/plan/source/subject/high-school/10/biology";
import { subjectHighSchool10ChemistryPlan } from "@repo/contents/_types/plan/source/subject/high-school/10/chemistry";
import { subjectHighSchool10HistoryPlan } from "@repo/contents/_types/plan/source/subject/high-school/10/history";
import { subjectHighSchool10MathematicsPlan } from "@repo/contents/_types/plan/source/subject/high-school/10/mathematics";
import { subjectHighSchool10PhysicsPlan } from "@repo/contents/_types/plan/source/subject/high-school/10/physics";
import { subjectHighSchool11BiologyPlan } from "@repo/contents/_types/plan/source/subject/high-school/11/biology";
import { subjectHighSchool11ChemistryPlan } from "@repo/contents/_types/plan/source/subject/high-school/11/chemistry";
import { subjectHighSchool11EconomyPlan } from "@repo/contents/_types/plan/source/subject/high-school/11/economy";
import { subjectHighSchool11GeographyPlan } from "@repo/contents/_types/plan/source/subject/high-school/11/geography";
import { subjectHighSchool11HistoryPlan } from "@repo/contents/_types/plan/source/subject/high-school/11/history";
import { subjectHighSchool11MathematicsPlan } from "@repo/contents/_types/plan/source/subject/high-school/11/mathematics";
import { subjectHighSchool11PhysicsPlan } from "@repo/contents/_types/plan/source/subject/high-school/11/physics";
import { subjectHighSchool11SociologyPlan } from "@repo/contents/_types/plan/source/subject/high-school/11/sociology";
import { subjectHighSchool12BiologyPlan } from "@repo/contents/_types/plan/source/subject/high-school/12/biology";
import { subjectHighSchool12ChemistryPlan } from "@repo/contents/_types/plan/source/subject/high-school/12/chemistry";
import { subjectHighSchool12EconomyPlan } from "@repo/contents/_types/plan/source/subject/high-school/12/economy";
import { subjectHighSchool12GeographyPlan } from "@repo/contents/_types/plan/source/subject/high-school/12/geography";
import { subjectHighSchool12HistoryPlan } from "@repo/contents/_types/plan/source/subject/high-school/12/history";
import { subjectHighSchool12MathematicsPlan } from "@repo/contents/_types/plan/source/subject/high-school/12/mathematics";
import { subjectHighSchool12PhysicsPlan } from "@repo/contents/_types/plan/source/subject/high-school/12/physics";
import { subjectHighSchool12SociologyPlan } from "@repo/contents/_types/plan/source/subject/high-school/12/sociology";
import { subjectMiddleSchool7MathematicsPlan } from "@repo/contents/_types/plan/source/subject/middle-school/7/mathematics";
import { subjectMiddleSchool8MathematicsPlan } from "@repo/contents/_types/plan/source/subject/middle-school/8/mathematics";
import { subjectMiddleSchool9MathematicsPlan } from "@repo/contents/_types/plan/source/subject/middle-school/9/mathematics";
import { subjectUniversityBachelorAiDsPlan } from "@repo/contents/_types/plan/source/subject/university/bachelor/ai-ds";
import { Schema } from "effect";

const planSourceInput = [
  exercisesHighSchoolSnbtEnglishLanguagePlan,
  exercisesHighSchoolSnbtGeneralKnowledgePlan,
  exercisesHighSchoolSnbtGeneralReasoningPlan,
  exercisesHighSchoolSnbtIndonesianLanguagePlan,
  exercisesHighSchoolSnbtMathematicalReasoningPlan,
  exercisesHighSchoolSnbtQuantitativeKnowledgePlan,
  exercisesHighSchoolSnbtReadingAndWritingSkillsPlan,
  exercisesHighSchoolTkaMathematicsPlan,
  exercisesMiddleSchoolGrade9MathematicsPlan,
  subjectHighSchool10BiologyPlan,
  subjectHighSchool10ChemistryPlan,
  subjectHighSchool10HistoryPlan,
  subjectHighSchool10MathematicsPlan,
  subjectHighSchool10PhysicsPlan,
  subjectHighSchool11BiologyPlan,
  subjectHighSchool11ChemistryPlan,
  subjectHighSchool11EconomyPlan,
  subjectHighSchool11GeographyPlan,
  subjectHighSchool11HistoryPlan,
  subjectHighSchool11MathematicsPlan,
  subjectHighSchool11PhysicsPlan,
  subjectHighSchool11SociologyPlan,
  subjectHighSchool12BiologyPlan,
  subjectHighSchool12ChemistryPlan,
  subjectHighSchool12EconomyPlan,
  subjectHighSchool12GeographyPlan,
  subjectHighSchool12HistoryPlan,
  subjectHighSchool12MathematicsPlan,
  subjectHighSchool12PhysicsPlan,
  subjectHighSchool12SociologyPlan,
  subjectMiddleSchool7MathematicsPlan,
  subjectMiddleSchool8MathematicsPlan,
  subjectMiddleSchool9MathematicsPlan,
  subjectUniversityBachelorAiDsPlan,
] satisfies readonly PlanSource[];

/**
 * Source-controlled plan registry for pedagogical order.
 *
 * Plans preserve curated topic/set order and localized navigation labels. They
 * do not define curriculum membership; coverage sync derives membership from
 * assets, concepts, outcomes, and program rules.
 */
export const PLAN_SOURCES = Schema.decodeUnknownSync(
  Schema.Array(PlanSourceSchema)
)(planSourceInput);
