import type { VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ReactNode } from "react";
import { contentWidthVariants } from "@/components/shared/content/width";

interface Props extends VariantProps<typeof contentWidthVariants> {
  children: ReactNode;
  className?: string;
}

/**
 * Renders the shared content surface with the page's gutter, at the column width unless `width`
 * names the page width.
 */
export function LayoutContent({ children, className, width }: Props) {
  return (
    <article
      className={cn(
        contentWidthVariants({ width }),
        "wrap-anywhere px-6",
        className
      )}
    >
      {children}
    </article>
  );
}
