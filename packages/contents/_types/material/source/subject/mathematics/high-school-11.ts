import { defineSubjectMaterial } from "@repo/contents/_types/material/schema";
import { subjectHighSchool11MathematicsCircleTopic } from "@repo/contents/_types/material/source/subject/mathematics/high-school-11/circle";
import { subjectHighSchool11MathematicsComplexNumberTopic } from "@repo/contents/_types/material/source/subject/mathematics/high-school-11/complex-number";
import { subjectHighSchool11MathematicsFunctionCompositionInverseFunctionTopic } from "@repo/contents/_types/material/source/subject/mathematics/high-school-11/function-composition-inverse-function";
import { subjectHighSchool11MathematicsFunctionModelingTopic } from "@repo/contents/_types/material/source/subject/mathematics/high-school-11/function-modeling";
import { subjectHighSchool11MathematicsGeometricTransformationTopic } from "@repo/contents/_types/material/source/subject/mathematics/high-school-11/geometric-transformation";
import { subjectHighSchool11MathematicsMatrixTopic } from "@repo/contents/_types/material/source/subject/mathematics/high-school-11/matrix";
import { subjectHighSchool11MathematicsPolynomialTopic } from "@repo/contents/_types/material/source/subject/mathematics/high-school-11/polynomial";
import { subjectHighSchool11MathematicsStatisticsTopic } from "@repo/contents/_types/material/source/subject/mathematics/high-school-11/statistics";

export const subjectHighSchool11MathematicsMaterial = defineSubjectMaterial({
  baseRoute: "subject/high-school/11/mathematics",
  category: "high-school",
  grade: "11",
  kind: "subject",
  key: "subject.high-school.11.mathematics",
  material: "mathematics",
  topics: [
    subjectHighSchool11MathematicsFunctionCompositionInverseFunctionTopic,
    subjectHighSchool11MathematicsCircleTopic,
    subjectHighSchool11MathematicsStatisticsTopic,
    subjectHighSchool11MathematicsComplexNumberTopic,
    subjectHighSchool11MathematicsPolynomialTopic,
    subjectHighSchool11MathematicsMatrixTopic,
    subjectHighSchool11MathematicsGeometricTransformationTopic,
    subjectHighSchool11MathematicsFunctionModelingTopic,
  ],
});
