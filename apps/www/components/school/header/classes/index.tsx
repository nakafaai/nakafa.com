"use client";

import { usePathname } from "@repo/internationalization/src/navigation";
import { SchoolHeaderClassesAdd } from "@/components/school/header/classes/add";
import { SchoolHeaderClassesInfo } from "@/components/school/header/classes/info";
import { SchoolHeaderClassesJoin } from "@/components/school/header/classes/join";
import { SchoolHeaderClassesSearch } from "@/components/school/header/classes/search";
import { useSchool } from "@/lib/context/use-school";
import { pathEndsWith } from "@/lib/utils/helper";

export function SchoolHeaderClasses() {
  const pathname = usePathname();

  if (pathEndsWith(pathname, "classes")) {
    return (
      <div className="flex w-full items-center justify-between gap-3">
        <SchoolHeaderClassesSearch />
        <SchoolHeaderClassesAction />
      </div>
    );
  }

  return <SchoolHeaderClassesInfo />;
}

function SchoolHeaderClassesAction() {
  const membership = useSchool((s) => s.membership);

  if (
    membership.role === "admin" ||
    membership.role === "teacher" ||
    membership.role === "demo"
  ) {
    return <SchoolHeaderClassesAdd />;
  }

  if (membership.role === "student") {
    return <SchoolHeaderClassesJoin />;
  }

  return null;
}
