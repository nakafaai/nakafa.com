import type { VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ReactNode } from "react";
import {
  pageFrameVariants,
  pageRowVariants,
} from "@/components/shared/content/width";

/**
 * Sets the width of everything under it: a page's header, tab row and body, which all read it. It draws no box of
 * its own, so the page's rows stay children of the shell's flow.
 */
export function PageFrame({
  children,
  width,
}: VariantProps<typeof pageFrameVariants> & {
  children: ReactNode;
}) {
  return <div className={pageFrameVariants({ width })}>{children}</div>;
}

/** Renders the shared content surface in one row of the page. */
export function LayoutContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={cn(pageRowVariants(), "wrap-anywhere", className)}>
      {children}
    </article>
  );
}
