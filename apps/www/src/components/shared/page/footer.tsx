import type { ReactNode } from "react";
import { pageBodyVariants } from "@/components/shared/page/width";

/**
 * The reading page's footer opens on a line as wide as the header, with equal space above and below. It waits for
 * the article body so it cannot shift down after the body streams in during navigation.
 */
export function PageFooter({ children }: { children: ReactNode }) {
  return (
    <footer
      className="relative mt-10 border-t pt-10 pb-20 [article:empty~&]:hidden"
      data-slot="page-footer"
    >
      <div className={pageBodyVariants()}>{children}</div>
    </footer>
  );
}
