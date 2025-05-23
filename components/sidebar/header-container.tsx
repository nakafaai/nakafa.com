"use client";

import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { type ReactNode, useMemo } from "react";

export function HeaderContainer({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const hideHeader = useMemo(() => {
    return pathname === "/" || pathname === "/search";
  }, [pathname]);

  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background/60 backdrop-blur-sm lg:border-t",
        // If the pathname is the home page, don't show the header
        hideHeader && "border-0 lg:hidden"
      )}
    >
      {children}
    </header>
  );
}
