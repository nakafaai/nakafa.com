import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ReactNode } from "react";

/**
 * The two widths a page's content takes, centred with the page's gutter: the reading width of
 * articles, lessons and a settings column of cards, and the app's page width of a working surface
 * such as a home or a class. No page's content is unbounded.
 */
const layoutContentVariants = cva("wrap-anywhere mx-auto px-6", {
  defaultVariants: { width: "reading" },
  variants: {
    width: {
      page: "max-w-7xl",
      reading: "max-w-3xl",
    },
  },
});

interface Props extends VariantProps<typeof layoutContentVariants> {
  children: ReactNode;
  className?: string;
}

/** Renders the shared content surface, at the reading width unless `width` names the page width. */
export function LayoutContent({ children, className, width }: Props) {
  return (
    <article className={cn(layoutContentVariants({ width }), className)}>
      {children}
    </article>
  );
}
