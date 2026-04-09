import { SchoolClassesPeopleHeader } from "@/components/school/classes/people/header";
import { SchoolClassesPeopleList } from "@/components/school/classes/people/list";
import { SchoolLayoutContent } from "@/components/school/layout-content";

export default function Page() {
  return (
    <SchoolLayoutContent>
      <SchoolClassesPeopleHeader />
      <SchoolClassesPeopleList />
    </SchoolLayoutContent>
  );
}
