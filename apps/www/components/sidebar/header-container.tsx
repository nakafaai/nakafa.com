import type { ReactNode } from "react";

export function HeaderContainer({ children }: { children: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 bg-background/30 backdrop-blur-xs lg:hidden">
      {children}
    </header>
  );
}
