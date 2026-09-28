import { SchoolClassesMaterialsHeader } from "@/components/school/classes/materials/header";
import { SchoolClassesMaterialsList } from "@/components/school/classes/materials/list";
import { SchoolLayoutContent } from "@/components/school/content";

export default function Page() {
  return (
    <SchoolLayoutContent>
      <SchoolClassesMaterialsHeader />
      <SchoolClassesMaterialsList />
    </SchoolLayoutContent>
  );
}
