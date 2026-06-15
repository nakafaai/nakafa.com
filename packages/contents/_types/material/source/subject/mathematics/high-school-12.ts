import { defineSubjectMaterial } from "@repo/contents/_types/material/schema";
import { subjectHighSchool12MathematicsAnalyticGeometryTopic } from "@repo/contents/_types/material/source/subject/mathematics/high-school-12/analytic-geometry";
import { subjectHighSchool12MathematicsCircleArcSectorTopic } from "@repo/contents/_types/material/source/subject/mathematics/high-school-12/circle-arc-sector";
import { subjectHighSchool12MathematicsCombinatoricsTopic } from "@repo/contents/_types/material/source/subject/mathematics/high-school-12/combinatorics";
import { subjectHighSchool12MathematicsDataAnalysisProbabilityTopic } from "@repo/contents/_types/material/source/subject/mathematics/high-school-12/data-analysis-probability";
import { subjectHighSchool12MathematicsDerivativeFunctionTopic } from "@repo/contents/_types/material/source/subject/mathematics/high-school-12/derivative-function";
import { subjectHighSchool12MathematicsFunctionTransformationTopic } from "@repo/contents/_types/material/source/subject/mathematics/high-school-12/function-transformation";
import { subjectHighSchool12MathematicsIntegralTopic } from "@repo/contents/_types/material/source/subject/mathematics/high-school-12/integral";
import { subjectHighSchool12MathematicsLimitTopic } from "@repo/contents/_types/material/source/subject/mathematics/high-school-12/limit";

export const subjectHighSchool12MathematicsMaterial = defineSubjectMaterial({
  baseRoute: "subject/high-school/12/mathematics",
  category: "high-school",
  grade: "12",
  kind: "subject",
  key: "subject.high-school.12.mathematics",
  material: "mathematics",
  topics: [
    subjectHighSchool12MathematicsFunctionTransformationTopic,
    subjectHighSchool12MathematicsCircleArcSectorTopic,
    subjectHighSchool12MathematicsCombinatoricsTopic,
    subjectHighSchool12MathematicsAnalyticGeometryTopic,
    subjectHighSchool12MathematicsLimitTopic,
    subjectHighSchool12MathematicsDerivativeFunctionTopic,
    subjectHighSchool12MathematicsIntegralTopic,
    subjectHighSchool12MathematicsDataAnalysisProbabilityTopic,
  ],
});
