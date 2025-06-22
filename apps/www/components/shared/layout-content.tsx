import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export function LayoutContent({ children, className }: Props) {
  return (
    <article className={cn("mx-auto max-w-3xl px-6", className)}>
      {children}
    </article>
  );
}
