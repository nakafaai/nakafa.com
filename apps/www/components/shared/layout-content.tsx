import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  as?: React.ElementType;
}

export function LayoutContent({ children, className, as = "article" }: Props) {
  const Component = as || "article";
  return (
    <Component className={cn("mx-auto max-w-3xl px-6", className)}>
      {children}
    </Component>
  );
}
