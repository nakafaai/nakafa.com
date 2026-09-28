import { type ReactNode, Suspense } from "react";
import { SchoolClassesForumHeader } from "@/components/school/classes/forum/header";
import { SchoolClassesForumList } from "@/components/school/classes/forum/list";
import { SchoolLayoutContent } from "@/components/school/content";

/**
 * Keep the shared forum surface mounted while forum child routes switch between
 * the feed and a selected conversation.
 */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <SchoolLayoutContent>
        <Suspense fallback={null}>
          <SchoolClassesForumHeader />
        </Suspense>
        <Suspense fallback={null}>
          <SchoolClassesForumList />
        </Suspense>
      </SchoolLayoutContent>
      {children}
    </>
  );
}
