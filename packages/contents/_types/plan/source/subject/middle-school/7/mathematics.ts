import { defineSubjectPlan } from "@repo/contents/_types/plan/schema";
import { subjectMiddleSchool7MathematicsAlgebraicFormsTopic } from "@repo/contents/_types/plan/source/subject/middle-school/7/mathematics/algebraic-forms";
import { subjectMiddleSchool7MathematicsDataDiagramsTopic } from "@repo/contents/_types/plan/source/subject/middle-school/7/mathematics/data-diagrams";
import { subjectMiddleSchool7MathematicsIntegersTopic } from "@repo/contents/_types/plan/source/subject/middle-school/7/mathematics/integers";
import { subjectMiddleSchool7MathematicsRatioTopic } from "@repo/contents/_types/plan/source/subject/middle-school/7/mathematics/ratio";
import { subjectMiddleSchool7MathematicsRationalNumbersTopic } from "@repo/contents/_types/plan/source/subject/middle-school/7/mathematics/rational-numbers";
import { subjectMiddleSchool7MathematicsSimilarityTopic } from "@repo/contents/_types/plan/source/subject/middle-school/7/mathematics/similarity";

export const subjectMiddleSchool7MathematicsPlan = defineSubjectPlan({
  baseRoute: "subject/middle-school/7/mathematics",
  category: "middle-school",
  grade: "7",
  kind: "subject",
  key: "subject.middle-school.7.mathematics",
  material: "mathematics",
  topics: [
    subjectMiddleSchool7MathematicsIntegersTopic,
    subjectMiddleSchool7MathematicsRationalNumbersTopic,
    subjectMiddleSchool7MathematicsRatioTopic,
    subjectMiddleSchool7MathematicsAlgebraicFormsTopic,
    subjectMiddleSchool7MathematicsSimilarityTopic,
    subjectMiddleSchool7MathematicsDataDiagramsTopic,
  ],
});
