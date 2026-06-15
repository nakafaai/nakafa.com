import { defineSubjectPlan } from "@repo/contents/_types/plan/schema";
import { subjectHighSchool12MathematicsAnalyticGeometryTopic } from "@repo/contents/_types/plan/source/subject/high-school/12/mathematics/analytic-geometry";
import { subjectHighSchool12MathematicsCircleArcSectorTopic } from "@repo/contents/_types/plan/source/subject/high-school/12/mathematics/circle-arc-sector";
import { subjectHighSchool12MathematicsCombinatoricsTopic } from "@repo/contents/_types/plan/source/subject/high-school/12/mathematics/combinatorics";
import { subjectHighSchool12MathematicsDataAnalysisProbabilityTopic } from "@repo/contents/_types/plan/source/subject/high-school/12/mathematics/data-analysis-probability";
import { subjectHighSchool12MathematicsDerivativeFunctionTopic } from "@repo/contents/_types/plan/source/subject/high-school/12/mathematics/derivative-function";
import { subjectHighSchool12MathematicsFunctionTransformationTopic } from "@repo/contents/_types/plan/source/subject/high-school/12/mathematics/function-transformation";
import { subjectHighSchool12MathematicsIntegralTopic } from "@repo/contents/_types/plan/source/subject/high-school/12/mathematics/integral";
import { subjectHighSchool12MathematicsLimitTopic } from "@repo/contents/_types/plan/source/subject/high-school/12/mathematics/limit";

export const subjectHighSchool12MathematicsPlan = defineSubjectPlan({
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
