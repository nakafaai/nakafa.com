"use client";

import { Group } from "@repo/design-system/components/ui/group";
import { SchoolClassesForumNew } from "@/components/school/classes/forum/new";
import { SchoolClassesForumSearch } from "@/components/school/classes/forum/search";

export function SchoolClassesForumHeader() {
  return (
    <Group className="w-full">
      <SchoolClassesForumSearch />
      <SchoolClassesForumNew />
    </Group>
  );
}
