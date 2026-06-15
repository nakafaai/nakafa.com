import { defineSubjectMaterial } from "@repo/contents/_types/material/schema";
import { subjectMiddleSchool7MathematicsAlgebraicFormsTopic } from "@repo/contents/_types/material/source/subject/mathematics/middle-school-7/algebraic-forms";
import { subjectMiddleSchool7MathematicsDataDiagramsTopic } from "@repo/contents/_types/material/source/subject/mathematics/middle-school-7/data-diagrams";
import { subjectMiddleSchool7MathematicsIntegersTopic } from "@repo/contents/_types/material/source/subject/mathematics/middle-school-7/integers";
import { subjectMiddleSchool7MathematicsRatioTopic } from "@repo/contents/_types/material/source/subject/mathematics/middle-school-7/ratio";
import { subjectMiddleSchool7MathematicsRationalNumbersTopic } from "@repo/contents/_types/material/source/subject/mathematics/middle-school-7/rational-numbers";
import { subjectMiddleSchool7MathematicsSimilarityTopic } from "@repo/contents/_types/material/source/subject/mathematics/middle-school-7/similarity";

export const subjectMiddleSchool7MathematicsMaterial = defineSubjectMaterial({
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
