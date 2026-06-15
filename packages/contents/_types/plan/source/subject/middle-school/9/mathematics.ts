import { defineSubjectPlan } from "@repo/contents/_types/plan/schema";
import { subjectMiddleSchool9MathematicsGeometricTransformationTopic } from "@repo/contents/_types/plan/source/subject/middle-school/9/mathematics/geometric-transformation";
import { subjectMiddleSchool9MathematicsLinearEquationsTwoVariablesTopic } from "@repo/contents/_types/plan/source/subject/middle-school/9/mathematics/linear-equations-two-variables";
import { subjectMiddleSchool9MathematicsProbabilitySamplingTopic } from "@repo/contents/_types/plan/source/subject/middle-school/9/mathematics/probability-sampling";
import { subjectMiddleSchool9MathematicsSolidGeometryTopic } from "@repo/contents/_types/plan/source/subject/middle-school/9/mathematics/solid-geometry";

export const subjectMiddleSchool9MathematicsPlan = defineSubjectPlan({
  baseRoute: "subject/middle-school/9/mathematics",
  category: "middle-school",
  grade: "9",
  kind: "subject",
  key: "subject.middle-school.9.mathematics",
  material: "mathematics",
  topics: [
    subjectMiddleSchool9MathematicsLinearEquationsTwoVariablesTopic,
    subjectMiddleSchool9MathematicsSolidGeometryTopic,
    subjectMiddleSchool9MathematicsGeometricTransformationTopic,
    subjectMiddleSchool9MathematicsProbabilitySamplingTopic,
  ],
});
