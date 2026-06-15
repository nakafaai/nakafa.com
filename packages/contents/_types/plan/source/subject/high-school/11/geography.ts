import { defineSubjectPlan } from "@repo/contents/_types/plan/schema";
import { subjectHighSchool11GeographyBiologicalDiversityTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/geography/biological-diversity";
import { subjectHighSchool11GeographyDisasterMitigationAdaptationTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/geography/disaster-mitigation-adaptation";
import { subjectHighSchool11GeographyEnvironmentPopulationTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/geography/environment-population";
import { subjectHighSchool11GeographyIndonesiaPositionTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/geography/indonesia-position";

export const subjectHighSchool11GeographyPlan = defineSubjectPlan({
  baseRoute: "subject/high-school/11/geography",
  category: "high-school",
  grade: "11",
  kind: "subject",
  key: "subject.high-school.11.geography",
  material: "geography",
  topics: [
    subjectHighSchool11GeographyIndonesiaPositionTopic,
    subjectHighSchool11GeographyBiologicalDiversityTopic,
    subjectHighSchool11GeographyEnvironmentPopulationTopic,
    subjectHighSchool11GeographyDisasterMitigationAdaptationTopic,
  ],
});
