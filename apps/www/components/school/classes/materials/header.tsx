"use client";

import { PERMISSIONS } from "@repo/backend/convex/lib/helpers/permissions";
import { Group } from "@repo/design-system/components/ui/group";
import { SchoolClassesMaterialsNew } from "@/components/school/classes/materials/new";
import { SchoolClassesMaterialsSearch } from "@/components/school/classes/materials/search";
import { useClassPermissions } from "@/lib/hooks/use-class-permissions";

export function SchoolClassesMaterialsHeader() {
  return (
    <Group className="w-full">
      <SchoolClassesMaterialsSearch />
      <SchoolClassesMaterialsHeaderAction />
    </Group>
  );
}

function SchoolClassesMaterialsHeaderAction() {
  const { can } = useClassPermissions();

  if (!can(PERMISSIONS.CONTENT_CREATE)) {
    return null;
  }

  return <SchoolClassesMaterialsNew />;
}
