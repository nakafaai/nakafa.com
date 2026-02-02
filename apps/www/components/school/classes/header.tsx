"use client";

import { PERMISSIONS } from "@repo/backend/convex/lib/helpers/permissions";
import { SchoolClassesHeaderAdd } from "@/components/school/classes/header-add";
import { SchoolClassesHeaderJoin } from "@/components/school/classes/header-join";
import { SchoolClassesHeaderSearch } from "@/components/school/classes/header-search";
import { HeaderContainer } from "@/components/school/header-container";
import { useSchool } from "@/lib/context/use-school";
import { useSchoolPermissions } from "@/lib/hooks/use-school-permissions";

export function SchoolClassesHeader() {
  return (
    <HeaderContainer>
      <div className="flex w-full items-center justify-between gap-3">
        <SchoolClassesHeaderSearch />
        <SchoolClassesHeaderAction />
      </div>
    </HeaderContainer>
  );
}

function SchoolClassesHeaderAction() {
  const { can } = useSchoolPermissions();
  const schoolMembership = useSchool((s) => s.schoolMembership);

  if (can(PERMISSIONS.CLASS_CREATE)) {
    return <SchoolClassesHeaderAdd />;
  }

  if (schoolMembership.role === "student") {
    return <SchoolClassesHeaderJoin />;
  }

  return null;
}
