import { defineSubjectPlan } from "@repo/contents/_types/plan/schema";
import { subjectHighSchool12PhysicsAlternatingCurrentTopic } from "@repo/contents/_types/plan/source/subject/high-school/12/physics/alternating-current";
import { subjectHighSchool12PhysicsDirectCurrentTopic } from "@repo/contents/_types/plan/source/subject/high-school/12/physics/direct-current";
import { subjectHighSchool12PhysicsElectromagneticWaveTopic } from "@repo/contents/_types/plan/source/subject/high-school/12/physics/electromagnetic-wave";
import { subjectHighSchool12PhysicsElectronicSystemsTopic } from "@repo/contents/_types/plan/source/subject/high-school/12/physics/electronic-systems";
import { subjectHighSchool12PhysicsMagnetismTopic } from "@repo/contents/_types/plan/source/subject/high-school/12/physics/magnetism";
import { subjectHighSchool12PhysicsNuclearPhysicsTopic } from "@repo/contents/_types/plan/source/subject/high-school/12/physics/nuclear-physics";
import { subjectHighSchool12PhysicsQuantumPhenomenaTopic } from "@repo/contents/_types/plan/source/subject/high-school/12/physics/quantum-phenomena";
import { subjectHighSchool12PhysicsRelativityTopic } from "@repo/contents/_types/plan/source/subject/high-school/12/physics/relativity";
import { subjectHighSchool12PhysicsStaticElectricityTopic } from "@repo/contents/_types/plan/source/subject/high-school/12/physics/static-electricity";

export const subjectHighSchool12PhysicsPlan = defineSubjectPlan({
  baseRoute: "subject/high-school/12/physics",
  category: "high-school",
  grade: "12",
  kind: "subject",
  key: "subject.high-school.12.physics",
  material: "physics",
  topics: [
    subjectHighSchool12PhysicsStaticElectricityTopic,
    subjectHighSchool12PhysicsDirectCurrentTopic,
    subjectHighSchool12PhysicsMagnetismTopic,
    subjectHighSchool12PhysicsAlternatingCurrentTopic,
    subjectHighSchool12PhysicsElectromagneticWaveTopic,
    subjectHighSchool12PhysicsElectronicSystemsTopic,
    subjectHighSchool12PhysicsRelativityTopic,
    subjectHighSchool12PhysicsQuantumPhenomenaTopic,
    subjectHighSchool12PhysicsNuclearPhysicsTopic,
  ],
});
