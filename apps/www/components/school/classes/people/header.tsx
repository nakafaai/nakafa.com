"use client";

import { PERMISSIONS } from "@repo/backend/confect/schools/permission/spec";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { useTranslations } from "next-intl";
import { SchoolClassesPeopleInvite } from "@/components/school/classes/people/invite";
import { SchoolClassesSearch } from "@/components/school/classes/search";
import { useClassPermissions } from "@/lib/school/classes/permissions";

/** Render the people toolbar for the active class. */
export function SchoolClassesPeopleHeader() {
  const t = useTranslations("School.Classes");

  return (
    <ButtonGroup className="w-full">
      <SchoolClassesSearch placeholder={t("people-search-placeholder")} />

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
