import type { ReactNode } from "react";
import { SchoolClassesForumPageContent } from "@/components/school/classes/forum/page-content";

/**
 * Keep the shared forum surface mounted while forum child routes switch between
 * the feed and a selected conversation.
 */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <SchoolClassesForumPageContent />
      {children}
    </>
  );
}
