"use client";

import { usePathname } from "next/navigation";
import { SchoolHeaderClasses } from "@/components/school/header/classes";

/**
 * SchoolHeader - Dynamically renders headers based on the current path
 * Add new header mappings here to scale easily
 */
export function SchoolHeader() {
  const pathname = usePathname();

  if (pathname.includes("/classes")) {
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
