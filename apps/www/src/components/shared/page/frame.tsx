import type { VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { pageFrameVariants } from "@/components/shared/page/width";

/**
 * A page of the app or of School: its header (`PageHeader`), its body (`PageBody`, `PageStack`, `PageState` or
 * `PageList`) and an optional footer (`PageFooter`), one under another. It sets the one width that every row of the
 * page reads, the column of a reading or settings page or the page width of a working surface, so the body can never
 * be wider than the header. It fills the height the shell leaves, so a list's card reaches the bottom of the screen,
 * and it never grows past the width beside the sidebar and a pane at the screen's right.
 */
export function Page({
  children,
  height,
  width,
}: VariantProps<typeof pageFrameVariants> & {
  children: ReactNode;
}) {
  return (
    <div className={pageFrameVariants({ height, width })} data-slot="page">
      {children}
    </div>
  );
}

/**
 * A catalog page of the app: a grid of visual choices whose header row and body
 * widen together to 4xl so three cards sit comfortably beside each other on desktop.
 */
export function CatalogPage({ children }: { children: ReactNode }) {
  return <Page width="catalog">{children}</Page>;
}
