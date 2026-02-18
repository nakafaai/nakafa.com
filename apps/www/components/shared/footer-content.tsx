import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  childrenClassName?: string;
  className?: string;
}

export function FooterContent({
  children,
  className,
  childrenClassName,
}: Props) {
  return (
    <footer className={cn("relative py-20", className)} data-pagefind-ignore>
      <div className={cn("z-10 mx-auto max-w-3xl px-6", childrenClassName)}>
        {children}
      </div>
    </footer>
  );
}
