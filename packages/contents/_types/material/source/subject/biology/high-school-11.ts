import { defineSubjectMaterial } from "@repo/contents/_types/material/schema";
import { subjectHighSchool11BiologyCellMembraneTopic } from "@repo/contents/_types/material/source/subject/biology/high-school-11/cell-membrane";
import { subjectHighSchool11BiologyExploreCellTopic } from "@repo/contents/_types/material/source/subject/biology/high-school-11/explore-cell";
import { subjectHighSchool11BiologyGrowthDevelopmentTopic } from "@repo/contents/_types/material/source/subject/biology/high-school-11/growth-development";
import { subjectHighSchool11BiologyHumanDefenseTopic } from "@repo/contents/_types/material/source/subject/biology/high-school-11/human-defense";
import { subjectHighSchool11BiologyHumanExchangeTopic } from "@repo/contents/_types/material/source/subject/biology/high-school-11/human-exchange";
import { subjectHighSchool11BiologyHumanMobilityTopic } from "@repo/contents/_types/material/source/subject/biology/high-school-11/human-mobility";
import { subjectHighSchool11BiologyPlantRegulationTopic } from "@repo/contents/_types/material/source/subject/biology/high-school-11/plant-regulation";
import { subjectHighSchool11BiologyReproductionHormoneTopic } from "@repo/contents/_types/material/source/subject/biology/high-school-11/reproduction-hormone";

export const subjectHighSchool11BiologyMaterial = defineSubjectMaterial({
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
