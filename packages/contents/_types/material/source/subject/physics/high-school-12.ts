import { defineSubjectMaterial } from "@repo/contents/_types/material/schema";
import { subjectHighSchool12PhysicsAlternatingCurrentTopic } from "@repo/contents/_types/material/source/subject/physics/high-school-12/alternating-current";
import { subjectHighSchool12PhysicsDirectCurrentTopic } from "@repo/contents/_types/material/source/subject/physics/high-school-12/direct-current";
import { subjectHighSchool12PhysicsElectromagneticWaveTopic } from "@repo/contents/_types/material/source/subject/physics/high-school-12/electromagnetic-wave";
import { subjectHighSchool12PhysicsElectronicSystemsTopic } from "@repo/contents/_types/material/source/subject/physics/high-school-12/electronic-systems";
import { subjectHighSchool12PhysicsMagnetismTopic } from "@repo/contents/_types/material/source/subject/physics/high-school-12/magnetism";
import { subjectHighSchool12PhysicsNuclearPhysicsTopic } from "@repo/contents/_types/material/source/subject/physics/high-school-12/nuclear-physics";
import { subjectHighSchool12PhysicsQuantumPhenomenaTopic } from "@repo/contents/_types/material/source/subject/physics/high-school-12/quantum-phenomena";
import { subjectHighSchool12PhysicsRelativityTopic } from "@repo/contents/_types/material/source/subject/physics/high-school-12/relativity";
import { subjectHighSchool12PhysicsStaticElectricityTopic } from "@repo/contents/_types/material/source/subject/physics/high-school-12/static-electricity";

export const subjectHighSchool12PhysicsMaterial = defineSubjectMaterial({
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
