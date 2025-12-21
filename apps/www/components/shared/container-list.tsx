import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
}

export function ContainerList({ children, className }: Props) {
  return (
    <div className={cn("grid grid-cols-1 gap-8 sm:grid-cols-2", className)}>
      {children}
    </div>
  );
}
