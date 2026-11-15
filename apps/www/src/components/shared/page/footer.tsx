import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { pageRowVariants } from "@/components/shared/page/width";

/**
 * The footer's frame. A ruled footer opens on a line as wide as the page, the same width as the line under the
 * page's header, with the same space above and below it, so a lesson's previous and next stand apart from its
 * comments and an article's body ends on the line its header began with.
 */
const footerVariants = cva("relative py-20 [article:empty~&]:hidden", {
  defaultVariants: { rule: false },
  variants: {
    rule: {
      false: "",
      true: "mt-10 border-t pt-10",
    },
  },
});

/**
 * The footer under a page's body, in one row of the page. It shows only once the article before it has its body:
 * after a client navigation the body of a server component arrives a moment after the page around it, and a footer
 * drawn before it would be pushed down.
 */
export function PageFooter({
  children,
  rule,
}: VariantProps<typeof footerVariants> & {
  children: ReactNode;
}) {
  return (
    <footer className={footerVariants({ rule })} data-slot="page-footer">
      <div className={pageRowVariants()}>{children}</div>
    </footer>
  );
}
