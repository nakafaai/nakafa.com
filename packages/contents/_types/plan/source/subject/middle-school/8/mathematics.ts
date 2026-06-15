import { defineSubjectPlan } from "@repo/contents/_types/plan/schema";
import { subjectMiddleSchool8MathematicsExponentsTopic } from "@repo/contents/_types/plan/source/subject/middle-school/8/mathematics/exponents";
import { subjectMiddleSchool8MathematicsLinearEquationsInequalitiesTopic } from "@repo/contents/_types/plan/source/subject/middle-school/8/mathematics/linear-equations-inequalities";
import { subjectMiddleSchool8MathematicsPythagoreanTheoremTopic } from "@repo/contents/_types/plan/source/subject/middle-school/8/mathematics/pythagorean-theorem";
import { subjectMiddleSchool8MathematicsRelationsFunctionsTopic } from "@repo/contents/_types/plan/source/subject/middle-school/8/mathematics/relations-functions";
import { subjectMiddleSchool8MathematicsStatisticsTopic } from "@repo/contents/_types/plan/source/subject/middle-school/8/mathematics/statistics";
import { subjectMiddleSchool8MathematicsStraightLineEquationsTopic } from "@repo/contents/_types/plan/source/subject/middle-school/8/mathematics/straight-line-equations";

export const subjectMiddleSchool8MathematicsPlan = defineSubjectPlan({
  baseRoute: "subject/middle-school/8/mathematics",
  category: "middle-school",
  grade: "8",
  kind: "subject",
  key: "subject.middle-school.8.mathematics",
  material: "mathematics",
  topics: [
    subjectMiddleSchool8MathematicsExponentsTopic,
    subjectMiddleSchool8MathematicsPythagoreanTheoremTopic,
    subjectMiddleSchool8MathematicsLinearEquationsInequalitiesTopic,
    subjectMiddleSchool8MathematicsRelationsFunctionsTopic,
    subjectMiddleSchool8MathematicsStraightLineEquationsTopic,
    subjectMiddleSchool8MathematicsStatisticsTopic,
  ],
});
