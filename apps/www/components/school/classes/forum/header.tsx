"use client";

import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { SchoolClassesForumNew } from "@/components/school/classes/forum/new";
import { SchoolClassesForumSearch } from "@/components/school/classes/forum/search";

export function SchoolClassesForumHeader() {
  return (
    <ButtonGroup className="w-full">
      <SchoolClassesForumSearch />
      <SchoolClassesForumNew />
    </ButtonGroup>
  );
}
