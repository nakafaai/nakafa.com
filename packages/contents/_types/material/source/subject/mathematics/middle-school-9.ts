import { defineSubjectMaterial } from "@repo/contents/_types/material/schema";
import { subjectMiddleSchool9MathematicsGeometricTransformationTopic } from "@repo/contents/_types/material/source/subject/mathematics/middle-school-9/geometric-transformation";
import { subjectMiddleSchool9MathematicsLinearEquationsTwoVariablesTopic } from "@repo/contents/_types/material/source/subject/mathematics/middle-school-9/linear-equations-two-variables";
import { subjectMiddleSchool9MathematicsProbabilitySamplingTopic } from "@repo/contents/_types/material/source/subject/mathematics/middle-school-9/probability-sampling";
import { subjectMiddleSchool9MathematicsSolidGeometryTopic } from "@repo/contents/_types/material/source/subject/mathematics/middle-school-9/solid-geometry";

export const subjectMiddleSchool9MathematicsMaterial = defineSubjectMaterial({
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
