import { defineSubjectMaterial } from "@repo/contents/_types/material/schema";
import { subjectHighSchool11PhysicsFluidTopic } from "@repo/contents/_types/material/source/subject/physics/high-school-11/fluid";
import { subjectHighSchool11PhysicsHeatTopic } from "@repo/contents/_types/material/source/subject/physics/high-school-11/heat";
import { subjectHighSchool11PhysicsKinematicsTopic } from "@repo/contents/_types/material/source/subject/physics/high-school-11/kinematics";
import { subjectHighSchool11PhysicsParticleDynamicsTopic } from "@repo/contents/_types/material/source/subject/physics/high-school-11/particle-dynamics";
import { subjectHighSchool11PhysicsThermodynamicsTopic } from "@repo/contents/_types/material/source/subject/physics/high-school-11/thermodynamics";
import { subjectHighSchool11PhysicsVectorTopic } from "@repo/contents/_types/material/source/subject/physics/high-school-11/vector";
import { subjectHighSchool11PhysicsWaveSoundLightTopic } from "@repo/contents/_types/material/source/subject/physics/high-school-11/wave-sound-light";

export const subjectHighSchool11PhysicsMaterial = defineSubjectMaterial({
  baseRoute: "subject/high-school/11/physics",
  category: "high-school",
  grade: "11",
  kind: "subject",
  key: "subject.high-school.11.physics",
  material: "physics",
  topics: [
    subjectHighSchool11PhysicsVectorTopic,
    subjectHighSchool11PhysicsKinematicsTopic,
    subjectHighSchool11PhysicsParticleDynamicsTopic,
    subjectHighSchool11PhysicsFluidTopic,
    subjectHighSchool11PhysicsWaveSoundLightTopic,
    subjectHighSchool11PhysicsHeatTopic,
    subjectHighSchool11PhysicsThermodynamicsTopic,
  ],
});
