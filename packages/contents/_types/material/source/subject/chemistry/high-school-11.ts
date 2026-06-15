import { defineSubjectMaterial } from "@repo/contents/_types/material/schema";
import { subjectHighSchool11ChemistryAtomicStructurePeriodicTableTopic } from "@repo/contents/_types/material/source/subject/chemistry/high-school-11/atomic-structure-periodic-table";
import { subjectHighSchool11ChemistryChemicalBondingTopic } from "@repo/contents/_types/material/source/subject/chemistry/high-school-11/chemical-bonding";
import { subjectHighSchool11ChemistryChemicalEquilibriumTopic } from "@repo/contents/_types/material/source/subject/chemistry/high-school-11/chemical-equilibrium";
import { subjectHighSchool11ChemistryHydrocarbonTopic } from "@repo/contents/_types/material/source/subject/chemistry/high-school-11/hydrocarbon";
import { subjectHighSchool11ChemistryKineticChemistryTopic } from "@repo/contents/_types/material/source/subject/chemistry/high-school-11/kinetic-chemistry";
import { subjectHighSchool11ChemistryStoichiometryTopic } from "@repo/contents/_types/material/source/subject/chemistry/high-school-11/stoichiometry";
import { subjectHighSchool11ChemistryThermochemistryTopic } from "@repo/contents/_types/material/source/subject/chemistry/high-school-11/thermochemistry";

export const subjectHighSchool11ChemistryMaterial = defineSubjectMaterial({
  baseRoute: "subject/high-school/11/chemistry",
  category: "high-school",
  grade: "11",
  kind: "subject",
  key: "subject.high-school.11.chemistry",
  material: "chemistry",
  topics: [
    subjectHighSchool11ChemistryAtomicStructurePeriodicTableTopic,
    subjectHighSchool11ChemistryChemicalBondingTopic,
    subjectHighSchool11ChemistryStoichiometryTopic,
    subjectHighSchool11ChemistryHydrocarbonTopic,
    subjectHighSchool11ChemistryThermochemistryTopic,
    subjectHighSchool11ChemistryKineticChemistryTopic,
    subjectHighSchool11ChemistryChemicalEquilibriumTopic,
  ],
});
