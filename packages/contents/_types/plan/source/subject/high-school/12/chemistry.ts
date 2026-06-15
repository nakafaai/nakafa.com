import { defineSubjectPlan } from "@repo/contents/_types/plan/schema";
import { subjectHighSchool12ChemistryElectrochemistryTopic } from "@repo/contents/_types/plan/source/subject/high-school/12/chemistry/electrochemistry";
import { subjectHighSchool12ChemistryFunctionalGroupCarbonCompoundTopic } from "@repo/contents/_types/plan/source/subject/high-school/12/chemistry/functional-group-carbon-compound";
import { subjectHighSchool12ChemistryOrganicMacromoleculeTopic } from "@repo/contents/_types/plan/source/subject/high-school/12/chemistry/organic-macromolecule";
import { subjectHighSchool12ChemistrySolutionColloidTopic } from "@repo/contents/_types/plan/source/subject/high-school/12/chemistry/solution-colloid";

export const subjectHighSchool12ChemistryPlan = defineSubjectPlan({
  baseRoute: "subject/high-school/12/chemistry",
  category: "high-school",
  grade: "12",
  kind: "subject",
  key: "subject.high-school.12.chemistry",
  material: "chemistry",
  topics: [
    subjectHighSchool12ChemistrySolutionColloidTopic,
    subjectHighSchool12ChemistryElectrochemistryTopic,
    subjectHighSchool12ChemistryFunctionalGroupCarbonCompoundTopic,
    subjectHighSchool12ChemistryOrganicMacromoleculeTopic,
  ],
});
