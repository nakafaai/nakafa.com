"use client";

import { usePathname } from "next/navigation";
import { SchoolHeaderClasses } from "@/components/school/header/classes";

export function SchoolHeader() {
  const pathname = usePathname();

  if (pathname.includes("/classes")) {
    return <SchoolHeaderClasses />;
  }

  return null;
}
