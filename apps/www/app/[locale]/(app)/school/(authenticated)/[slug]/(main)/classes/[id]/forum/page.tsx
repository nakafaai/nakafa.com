import { SchoolClassesForumHeader } from "@/components/school/classes/forum/header";
import { SchoolClassesForumList } from "@/components/school/classes/forum/list";
import { SchoolLayoutContent } from "@/components/school/layout-content";

export default function Page() {
  return (
    <SchoolLayoutContent>
      <SchoolClassesForumHeader />
      <SchoolClassesForumList />
    </SchoolLayoutContent>
  );
}
