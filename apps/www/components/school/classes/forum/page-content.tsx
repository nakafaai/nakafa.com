import { Suspense } from "react";
import { SchoolClassesForumHeader } from "@/components/school/classes/forum/header";
import { SchoolClassesForumList } from "@/components/school/classes/forum/list";
import { SchoolLayoutContent } from "@/components/school/layout-content";

/** Render the main forum page surface shared by the list and detail routes. */
export function SchoolClassesForumPageContent() {
  return (
    <SchoolLayoutContent>
      <Suspense fallback={null}>
        <SchoolClassesForumHeader />
      </Suspense>
      <Suspense fallback={null}>
        <SchoolClassesForumList />
      </Suspense>
    </SchoolLayoutContent>
  );
}
