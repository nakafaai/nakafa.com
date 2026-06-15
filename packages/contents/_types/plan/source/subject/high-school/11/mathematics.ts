import { defineSubjectPlan } from "@repo/contents/_types/plan/schema";
import { subjectHighSchool11MathematicsCircleTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/mathematics/circle";
import { subjectHighSchool11MathematicsComplexNumberTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/mathematics/complex-number";
import { subjectHighSchool11MathematicsFunctionCompositionInverseFunctionTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/mathematics/function-composition-inverse-function";
import { subjectHighSchool11MathematicsFunctionModelingTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/mathematics/function-modeling";
import { subjectHighSchool11MathematicsGeometricTransformationTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/mathematics/geometric-transformation";
import { subjectHighSchool11MathematicsMatrixTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/mathematics/matrix";
import { subjectHighSchool11MathematicsPolynomialTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/mathematics/polynomial";
import { subjectHighSchool11MathematicsStatisticsTopic } from "@repo/contents/_types/plan/source/subject/high-school/11/mathematics/statistics";

export const subjectHighSchool11MathematicsPlan = defineSubjectPlan({
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
