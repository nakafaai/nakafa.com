import { cn } from "cn";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
}

/** Renders the shared article-width content surface. */
export function LayoutContent({ children, className }: Props) {
  return (
    <article className={cn("wrap-anywhere mx-auto max-w-3xl px-6", className)}>
      {children}
    </article>
  );
}
