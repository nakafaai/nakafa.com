import { defineSubjectMaterial } from "@repo/contents/_types/material/schema";
import { subjectMiddleSchool8MathematicsExponentsTopic } from "@repo/contents/_types/material/source/subject/mathematics/middle-school-8/exponents";
import { subjectMiddleSchool8MathematicsLinearEquationsInequalitiesTopic } from "@repo/contents/_types/material/source/subject/mathematics/middle-school-8/linear-equations-inequalities";
import { subjectMiddleSchool8MathematicsPythagoreanTheoremTopic } from "@repo/contents/_types/material/source/subject/mathematics/middle-school-8/pythagorean-theorem";
import { subjectMiddleSchool8MathematicsRelationsFunctionsTopic } from "@repo/contents/_types/material/source/subject/mathematics/middle-school-8/relations-functions";
import { subjectMiddleSchool8MathematicsStatisticsTopic } from "@repo/contents/_types/material/source/subject/mathematics/middle-school-8/statistics";
import { subjectMiddleSchool8MathematicsStraightLineEquationsTopic } from "@repo/contents/_types/material/source/subject/mathematics/middle-school-8/straight-line-equations";

export const subjectMiddleSchool8MathematicsMaterial = defineSubjectMaterial({
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
