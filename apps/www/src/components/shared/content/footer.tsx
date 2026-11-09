import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ReactNode } from "react";
import { pageRowVariants } from "@/components/shared/content/width";

/**
 * The footer's frame. A ruled footer opens on a line as wide as the page, the same width as the line under the
 * page's header, with the same space above and below it, so a lesson's previous and next stand apart from its
 * comments and an article's body ends on the line its header began with.
 */
const footerVariants = cva("relative py-20 [article:empty~&]:hidden", {
  variants: {
    rule: {
      true: "mt-10 border-t pt-10",
      false: "",
    },
  },
  defaultVariants: {
    rule: false,
  },
});

type Props = VariantProps<typeof footerVariants> & {
  children: ReactNode;
  childrenClassName?: string;
  className?: string;
};

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
  rule,
}: Props) {
  return (
    <footer className={cn(footerVariants({ rule }), className)}>
      <div className={cn(pageRowVariants(), "z-10", childrenClassName)}>
        {children}
      </div>
    </footer>
  );
}
