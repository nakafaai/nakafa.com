"use client";

import { usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function HeaderContainer({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <header
      className={cn(
        "sticky top-0 z-50 flex h-16 shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/80 backdrop-blur-sm",
        // If the pathname is the home page, don't show the header
        pathname === "/" && "md:hidden"
      )}
    >
      {children}
    </header>
  );
}
