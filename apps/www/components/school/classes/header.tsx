"use client";

import { SchoolClassesHeaderAdd } from "@/components/school/classes/header-add";
import { SchoolClassesHeaderJoin } from "@/components/school/classes/header-join";
import { SchoolClassesHeaderSearch } from "@/components/school/classes/header-search";
import { HeaderContainer } from "@/components/school/header-container";
import { useSchool } from "@/lib/context/use-school";

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
  const schoolMembership = useSchool((s) => s.schoolMembership);

  if (
    schoolMembership.role === "admin" ||
    schoolMembership.role === "teacher" ||
    schoolMembership.role === "demo"
  ) {
    return <SchoolClassesHeaderAdd />;
  }

  if (schoolMembership.role === "student") {
    return <SchoolClassesHeaderJoin />;
  }

  return null;
}
