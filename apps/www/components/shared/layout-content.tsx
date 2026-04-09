import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";

interface Props {
  as?: React.ElementType;
  children: ReactNode;
  className?: string;
}

export function LayoutContent({ children, className, as = "article" }: Props) {
  const Component = as || "article";
  return (
    <Component className={cn("mx-auto max-w-3xl px-6", className)}>
      {children}
    </Component>
  );
}
