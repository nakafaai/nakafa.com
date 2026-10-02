"use client";

import { PERMISSIONS } from "@repo/backend/confect/schools/permission/spec";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { useTranslations } from "next-intl";
import { SchoolClassesMaterialsNew } from "@/components/school/classes/materials/new";
import { SchoolClassesSearch } from "@/components/school/classes/search";
import { useClassPermissions } from "@/lib/school/classes/permissions";
export function SchoolClassesMaterialsHeader() {
  const t = useTranslations("School.Classes");

  return (
    <ButtonGroup className="w-full">
      <SchoolClassesSearch placeholder={t("modules-search-placeholder")} />
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
