import { cn } from "cn";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  childrenClassName?: string;
  className?: string;
}

/**
 * The footer under a page's content. It shows only once the article before it
 * has its body: after a client navigation the body of a server component arrives
 * a moment after the page around it, and a footer drawn before it would be pushed
 * down.
 */
export function FooterContent({
  children,
  className,
  childrenClassName,
}: Props) {
  return (
    <footer
      className={cn("relative py-20 [article:empty~&]:hidden", className)}
    >
      <div className={cn("z-10 mx-auto max-w-3xl px-6", childrenClassName)}>
        {children}
      </div>
    </footer>
  );
}
