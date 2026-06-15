import { defineSubjectPlan } from "@repo/contents/_types/plan/schema";
import { subjectHighSchool11ChemistryAtomicStructurePeriodicTableTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/chemistry/atomic-structure-periodic-table";
import { subjectHighSchool11ChemistryChemicalBondingTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/chemistry/chemical-bonding";
import { subjectHighSchool11ChemistryChemicalEquilibriumTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/chemistry/chemical-equilibrium";
import { subjectHighSchool11ChemistryHydrocarbonTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/chemistry/hydrocarbon";
import { subjectHighSchool11ChemistryKineticChemistryTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/chemistry/kinetic-chemistry";
import { subjectHighSchool11ChemistryStoichiometryTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/chemistry/stoichiometry";
import { subjectHighSchool11ChemistryThermochemistryTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/chemistry/thermochemistry";

export const subjectHighSchool11ChemistryPlan = defineSubjectPlan({
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
