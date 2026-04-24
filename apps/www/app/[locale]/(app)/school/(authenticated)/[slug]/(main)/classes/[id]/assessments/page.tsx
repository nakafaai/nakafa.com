import { SchoolClassesAssessmentsHeader } from "@/components/school/classes/assessments/header";
import { SchoolClassesAssessmentsList } from "@/components/school/classes/assessments/list";
import { SchoolLayoutContent } from "@/components/school/layout-content";

export default function Page() {
  return (
    <SchoolLayoutContent>
      <SchoolClassesAssessmentsHeader />
      <SchoolClassesAssessmentsList />
    </SchoolLayoutContent>
  );
}
