"use client";

import { PERMISSIONS } from "@repo/backend/convex/lib/helpers/permissions";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { SchoolClassesPeopleInvite } from "@/components/school/classes/people/invite";
import { SchoolClassesPeopleSearch } from "@/components/school/classes/people/search";
import { useClassPermissions } from "@/lib/hooks/use-class-permissions";

/** Render the people toolbar for the active class. */
export function SchoolClassesPeopleHeader() {
  return (
    <ButtonGroup className="w-full">
      <SchoolClassesPeopleSearch />

      <SchoolClassesPeopleHeaderAction />
    </ButtonGroup>
  );
}

/** Render the roster action area using the shared class permission model. */
function SchoolClassesPeopleHeaderAction() {
  const { can } = useClassPermissions();

  if (!can(PERMISSIONS.MEMBER_ADD)) {
    return null;
  }

  return <SchoolClassesPeopleInvite />;
}
