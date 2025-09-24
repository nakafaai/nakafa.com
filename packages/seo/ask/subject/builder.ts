import { highSchool10MathematicsData } from "@repo/seo/ask/subject/high-school/10/mathematics/data";
import { highSchool11MathematicsData } from "@repo/seo/ask/subject/high-school/11/mathematics/data";
import { highSchool12MathematicsData } from "@repo/seo/ask/subject/high-school/12/mathematics/data";

export function buildSubjects() {
  const subjects = [
    ...highSchool10MathematicsData,
    ...highSchool11MathematicsData,
    ...highSchool12MathematicsData,
  ];

  return subjects.map((subject) => ({
    ...subject,
    type: "subject",
  }));
}
