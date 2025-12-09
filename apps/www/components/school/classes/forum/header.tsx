"use client";

import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { SchoolClassesForumNew } from "./new";
import { SchoolClassesForumSearch } from "./search";

export function SchoolClassesForumHeader() {
  return (
    <ButtonGroup className="w-full">
      <SchoolClassesForumSearch />
      <SchoolClassesForumNew />
    </ButtonGroup>
  );
}
