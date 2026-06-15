import { defineSubjectMaterial } from "@repo/contents/_types/material/schema";
import { subjectHighSchool12ChemistryElectrochemistryTopic } from "@repo/contents/_types/material/source/subject/chemistry/high-school-12/electrochemistry";
import { subjectHighSchool12ChemistryFunctionalGroupCarbonCompoundTopic } from "@repo/contents/_types/material/source/subject/chemistry/high-school-12/functional-group-carbon-compound";
import { subjectHighSchool12ChemistryOrganicMacromoleculeTopic } from "@repo/contents/_types/material/source/subject/chemistry/high-school-12/organic-macromolecule";
import { subjectHighSchool12ChemistrySolutionColloidTopic } from "@repo/contents/_types/material/source/subject/chemistry/high-school-12/solution-colloid";

export const subjectHighSchool12ChemistryMaterial = defineSubjectMaterial({
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
