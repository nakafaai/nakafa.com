import { defineSubjectMaterial } from "@repo/contents/_types/material/schema";
import { subjectHighSchool10MathematicsExponentialLogarithmTopic } from "@repo/contents/_types/material/source/subject/mathematics/high-school-10/exponential-logarithm";
import { subjectHighSchool10MathematicsLinearEquationInequalityTopic } from "@repo/contents/_types/material/source/subject/mathematics/high-school-10/linear-equation-inequality";
import { subjectHighSchool10MathematicsProbabilityTopic } from "@repo/contents/_types/material/source/subject/mathematics/high-school-10/probability";
import { subjectHighSchool10MathematicsQuadraticFunctionTopic } from "@repo/contents/_types/material/source/subject/mathematics/high-school-10/quadratic-function";
import { subjectHighSchool10MathematicsSequenceSeriesTopic } from "@repo/contents/_types/material/source/subject/mathematics/high-school-10/sequence-series";
import { subjectHighSchool10MathematicsStatisticsTopic } from "@repo/contents/_types/material/source/subject/mathematics/high-school-10/statistics";
import { subjectHighSchool10MathematicsTrigonometryTopic } from "@repo/contents/_types/material/source/subject/mathematics/high-school-10/trigonometry";
import { subjectHighSchool10MathematicsVectorOperationsTopic } from "@repo/contents/_types/material/source/subject/mathematics/high-school-10/vector-operations";

export const subjectHighSchool10MathematicsMaterial = defineSubjectMaterial({
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
