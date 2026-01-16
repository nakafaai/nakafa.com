"use client";

import { PERMISSIONS } from "@repo/backend/convex/lib/permissions";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { SchoolClassesMaterialsNew } from "@/components/school/classes/materials/new";
import { SchoolClassesMaterialsSearch } from "@/components/school/classes/materials/search";
import { useClassPermissions } from "@/lib/hooks/use-class-permissions";

export function SchoolClassesMaterialsHeader() {
  return (
    <ButtonGroup className="w-full">
      <SchoolClassesMaterialsSearch />
      <SchoolClassesMaterialsHeaderAction />
    </ButtonGroup>
  );
}

function SchoolClassesMaterialsHeaderAction() {
  const { can } = useClassPermissions();

  if (!can(PERMISSIONS.CONTENT_CREATE)) {
    return null;
  }

  return <SchoolClassesMaterialsNew />;
}
