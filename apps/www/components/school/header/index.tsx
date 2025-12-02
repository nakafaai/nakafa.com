"use client";

import { usePathname } from "next/navigation";
import { SchoolHeaderClasses } from "@/components/school/header/classes";

/**
 * Helper function to check if pathname ends with a specific segment
 * Example: /school/slug/classes -> matches "classes"
 * Example: /school/slug/classes/123 -> does not match "classes"
 */
function pathEndsWith(pathname: string, segment: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  return parts.at(-1) === segment;
}

/**
 * SchoolHeader - Dynamically renders headers based on the current path
 * Add new header mappings here to scale easily
 */
export function SchoolHeader() {
  const pathname = usePathname();

  if (pathEndsWith(pathname, "classes")) {
    return (
      <HeaderContainer>
        <SchoolHeaderClasses />
      </HeaderContainer>
    );
  }

  return null;
}

function HeaderContainer({ children }: { children: React.ReactNode }) {
  return (
    <header className="flex h-16 w-full shrink-0 border-b">
      <div className="mx-auto flex w-full max-w-6xl gap-3 px-6">{children}</div>
    </header>
  );
}
