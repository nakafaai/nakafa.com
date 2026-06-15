import type { MaterialSource } from "@repo/contents/_types/material/schema";
import { MaterialSourceSchema } from "@repo/contents/_types/material/schema";
import { exercisesHighSchoolSnbtEnglishLanguageMaterial } from "@repo/contents/_types/material/source/exercises/high-school/snbt/english-language";
import { exercisesHighSchoolSnbtGeneralKnowledgeMaterial } from "@repo/contents/_types/material/source/exercises/high-school/snbt/general-knowledge";
import { exercisesHighSchoolSnbtGeneralReasoningMaterial } from "@repo/contents/_types/material/source/exercises/high-school/snbt/general-reasoning";
import { exercisesHighSchoolSnbtIndonesianLanguageMaterial } from "@repo/contents/_types/material/source/exercises/high-school/snbt/indonesian-language";
import { exercisesHighSchoolSnbtMathematicalReasoningMaterial } from "@repo/contents/_types/material/source/exercises/high-school/snbt/mathematical-reasoning";
import { exercisesHighSchoolSnbtQuantitativeKnowledgeMaterial } from "@repo/contents/_types/material/source/exercises/high-school/snbt/quantitative-knowledge";
import { exercisesHighSchoolSnbtReadingAndWritingSkillsMaterial } from "@repo/contents/_types/material/source/exercises/high-school/snbt/reading-and-writing-skills";
import { exercisesHighSchoolTkaMathematicsMaterial } from "@repo/contents/_types/material/source/exercises/high-school/tka/mathematics";
import { exercisesMiddleSchoolGrade9MathematicsMaterial } from "@repo/contents/_types/material/source/exercises/middle-school/grade-9/mathematics";
import { subjectUniversityBachelorAiDsMaterial } from "@repo/contents/_types/material/source/subject/ai-ds/university-bachelor";
import { subjectHighSchool10BiologyMaterial } from "@repo/contents/_types/material/source/subject/biology/high-school-10";
import { subjectHighSchool11BiologyMaterial } from "@repo/contents/_types/material/source/subject/biology/high-school-11";
import { subjectHighSchool12BiologyMaterial } from "@repo/contents/_types/material/source/subject/biology/high-school-12";
import { subjectHighSchool10ChemistryMaterial } from "@repo/contents/_types/material/source/subject/chemistry/high-school-10";
import { subjectHighSchool11ChemistryMaterial } from "@repo/contents/_types/material/source/subject/chemistry/high-school-11";
import { subjectHighSchool12ChemistryMaterial } from "@repo/contents/_types/material/source/subject/chemistry/high-school-12";
import { subjectHighSchool11EconomyMaterial } from "@repo/contents/_types/material/source/subject/economy/high-school-11";
import { subjectHighSchool12EconomyMaterial } from "@repo/contents/_types/material/source/subject/economy/high-school-12";
import { subjectHighSchool11GeographyMaterial } from "@repo/contents/_types/material/source/subject/geography/high-school-11";
import { subjectHighSchool12GeographyMaterial } from "@repo/contents/_types/material/source/subject/geography/high-school-12";
import { subjectHighSchool10HistoryMaterial } from "@repo/contents/_types/material/source/subject/history/high-school-10";
import { subjectHighSchool11HistoryMaterial } from "@repo/contents/_types/material/source/subject/history/high-school-11";
import { subjectHighSchool12HistoryMaterial } from "@repo/contents/_types/material/source/subject/history/high-school-12";
import { subjectHighSchool10MathematicsMaterial } from "@repo/contents/_types/material/source/subject/mathematics/high-school-10";
import { subjectHighSchool11MathematicsMaterial } from "@repo/contents/_types/material/source/subject/mathematics/high-school-11";
import { subjectHighSchool12MathematicsMaterial } from "@repo/contents/_types/material/source/subject/mathematics/high-school-12";
import { subjectMiddleSchool7MathematicsMaterial } from "@repo/contents/_types/material/source/subject/mathematics/middle-school-7";
import { subjectMiddleSchool8MathematicsMaterial } from "@repo/contents/_types/material/source/subject/mathematics/middle-school-8";
import { subjectMiddleSchool9MathematicsMaterial } from "@repo/contents/_types/material/source/subject/mathematics/middle-school-9";
import { subjectHighSchool10PhysicsMaterial } from "@repo/contents/_types/material/source/subject/physics/high-school-10";
import { subjectHighSchool11PhysicsMaterial } from "@repo/contents/_types/material/source/subject/physics/high-school-11";
import { subjectHighSchool12PhysicsMaterial } from "@repo/contents/_types/material/source/subject/physics/high-school-12";
import { subjectHighSchool11SociologyMaterial } from "@repo/contents/_types/material/source/subject/sociology/high-school-11";
import { subjectHighSchool12SociologyMaterial } from "@repo/contents/_types/material/source/subject/sociology/high-school-12";
import { Schema } from "effect";

const materialSourceInput = [
  exercisesHighSchoolSnbtEnglishLanguageMaterial,
  exercisesHighSchoolSnbtGeneralKnowledgeMaterial,
  exercisesHighSchoolSnbtGeneralReasoningMaterial,
  exercisesHighSchoolSnbtIndonesianLanguageMaterial,
  exercisesHighSchoolSnbtMathematicalReasoningMaterial,
  exercisesHighSchoolSnbtQuantitativeKnowledgeMaterial,
  exercisesHighSchoolSnbtReadingAndWritingSkillsMaterial,
  exercisesHighSchoolTkaMathematicsMaterial,
  exercisesMiddleSchoolGrade9MathematicsMaterial,
  subjectHighSchool10BiologyMaterial,
  subjectHighSchool10ChemistryMaterial,
  subjectHighSchool10HistoryMaterial,
  subjectHighSchool10MathematicsMaterial,
  subjectHighSchool10PhysicsMaterial,
  subjectHighSchool11BiologyMaterial,
  subjectHighSchool11ChemistryMaterial,
  subjectHighSchool11EconomyMaterial,
  subjectHighSchool11GeographyMaterial,
  subjectHighSchool11HistoryMaterial,
  subjectHighSchool11MathematicsMaterial,
  subjectHighSchool11PhysicsMaterial,
  subjectHighSchool11SociologyMaterial,
  subjectHighSchool12BiologyMaterial,
  subjectHighSchool12ChemistryMaterial,
  subjectHighSchool12EconomyMaterial,
  subjectHighSchool12GeographyMaterial,
  subjectHighSchool12HistoryMaterial,
  subjectHighSchool12MathematicsMaterial,
  subjectHighSchool12PhysicsMaterial,
  subjectHighSchool12SociologyMaterial,
  subjectMiddleSchool7MathematicsMaterial,
  subjectMiddleSchool8MathematicsMaterial,
  subjectMiddleSchool9MathematicsMaterial,
  subjectUniversityBachelorAiDsMaterial,
] satisfies readonly MaterialSource[];

/**
 * Source-controlled material registry for pedagogical order.
 *
 * Materials preserve localized asset routes and their learner-facing topic/set
 * labels. They do not define curriculum membership; curriculum and assessment
 * source modules map reusable material keys into program-specific structures.
 */
export const MATERIAL_SOURCES = Schema.decodeUnknownSync(
  Schema.Array(MaterialSourceSchema)
)(materialSourceInput);
