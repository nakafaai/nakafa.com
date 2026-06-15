import { defineSubjectPlan } from "@repo/contents/_types/plan/schema";
import { subjectHighSchool11BiologyCellMembraneTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/biology/cell-membrane";
import { subjectHighSchool11BiologyExploreCellTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/biology/explore-cell";
import { subjectHighSchool11BiologyGrowthDevelopmentTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/biology/growth-development";
import { subjectHighSchool11BiologyHumanDefenseTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/biology/human-defense";
import { subjectHighSchool11BiologyHumanExchangeTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/biology/human-exchange";
import { subjectHighSchool11BiologyHumanMobilityTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/biology/human-mobility";
import { subjectHighSchool11BiologyPlantRegulationTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/biology/plant-regulation";
import { subjectHighSchool11BiologyReproductionHormoneTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/biology/reproduction-hormone";

export const subjectHighSchool11BiologyPlan = defineSubjectPlan({
  baseRoute: "subject/high-school/11/biology",
  category: "high-school",
  grade: "11",
  kind: "subject",
  key: "subject.high-school.11.biology",
  material: "biology",
  topics: [
    subjectHighSchool11BiologyExploreCellTopic,
    subjectHighSchool11BiologyCellMembraneTopic,
    subjectHighSchool11BiologyPlantRegulationTopic,
    subjectHighSchool11BiologyHumanExchangeTopic,
    subjectHighSchool11BiologyHumanDefenseTopic,
    subjectHighSchool11BiologyHumanMobilityTopic,
    subjectHighSchool11BiologyReproductionHormoneTopic,
    subjectHighSchool11BiologyGrowthDevelopmentTopic,
  ],
});
