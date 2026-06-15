import { defineSubjectPlan } from "@repo/contents/_types/plan/schema";
import { subjectHighSchool10MathematicsExponentialLogarithmTopic } from "@repo/contents/_types/plan/source/subject/high-school/10/mathematics/exponential-logarithm";
import { subjectHighSchool10MathematicsLinearEquationInequalityTopic } from "@repo/contents/_types/plan/source/subject/high-school/10/mathematics/linear-equation-inequality";
import { subjectHighSchool10MathematicsProbabilityTopic } from "@repo/contents/_types/plan/source/subject/high-school/10/mathematics/probability";
import { subjectHighSchool10MathematicsQuadraticFunctionTopic } from "@repo/contents/_types/plan/source/subject/high-school/10/mathematics/quadratic-function";
import { subjectHighSchool10MathematicsSequenceSeriesTopic } from "@repo/contents/_types/plan/source/subject/high-school/10/mathematics/sequence-series";
import { subjectHighSchool10MathematicsStatisticsTopic } from "@repo/contents/_types/plan/source/subject/high-school/10/mathematics/statistics";
import { subjectHighSchool10MathematicsTrigonometryTopic } from "@repo/contents/_types/plan/source/subject/high-school/10/mathematics/trigonometry";
import { subjectHighSchool10MathematicsVectorOperationsTopic } from "@repo/contents/_types/plan/source/subject/high-school/10/mathematics/vector-operations";

export const subjectHighSchool10MathematicsPlan = defineSubjectPlan({
  baseRoute: "subject/high-school/10/mathematics",
  category: "high-school",
  grade: "10",
  kind: "subject",
  key: "subject.high-school.10.mathematics",
  material: "mathematics",
  topics: [
    subjectHighSchool10MathematicsExponentialLogarithmTopic,
    subjectHighSchool10MathematicsSequenceSeriesTopic,
    subjectHighSchool10MathematicsVectorOperationsTopic,
    subjectHighSchool10MathematicsTrigonometryTopic,
    subjectHighSchool10MathematicsLinearEquationInequalityTopic,
    subjectHighSchool10MathematicsQuadraticFunctionTopic,
    subjectHighSchool10MathematicsStatisticsTopic,
    subjectHighSchool10MathematicsProbabilityTopic,
  ],
});
