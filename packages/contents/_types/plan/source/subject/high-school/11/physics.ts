import { defineSubjectPlan } from "@repo/contents/_types/plan/schema";
import { subjectHighSchool11PhysicsFluidTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/physics/fluid";
import { subjectHighSchool11PhysicsHeatTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/physics/heat";
import { subjectHighSchool11PhysicsKinematicsTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/physics/kinematics";
import { subjectHighSchool11PhysicsParticleDynamicsTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/physics/particle-dynamics";
import { subjectHighSchool11PhysicsThermodynamicsTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/physics/thermodynamics";
import { subjectHighSchool11PhysicsVectorTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/physics/vector";
import { subjectHighSchool11PhysicsWaveSoundLightTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/physics/wave-sound-light";

export const subjectHighSchool11PhysicsPlan = defineSubjectPlan({
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
