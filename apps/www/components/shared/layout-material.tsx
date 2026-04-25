import type { ParsedHeading } from "@repo/contents/_types/toc";
import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps, ReactNode } from "react";
import { FooterContent } from "./footer-content";
import { HeaderContent } from "./header-content";
import { LayoutContent } from "./layout-content";
import { PaginationContent } from "./pagination-content";
import { SidebarRight } from "./sidebar-right";
import { SidebarTree } from "./sidebar-tree";

export function LayoutMaterialHeader({
  ...props
}: ComponentProps<typeof HeaderContent>) {
  return <HeaderContent {...props} />;
}

/**
 * Renders the main material column.
 *
 * `min-w-0` lets the flex item shrink below its content's min-content width,
 * while BlockMath and Mermaid keep their own internal horizontal scroll.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/flex
 */
export function LayoutMaterialContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("min-w-0 flex-1", className)}>{children}</div>;
}

export function LayoutMaterialMain({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & ComponentProps<typeof LayoutContent>) {
  return (
    <LayoutContent {...props} className={className}>
      {children}
    </LayoutContent>
  );
}

export function LayoutMaterialPagination({
  ...props
}: ComponentProps<typeof PaginationContent>) {
  return <PaginationContent {...props} />;
}

export function LayoutMaterialFooter({
  ...props
}: ComponentProps<typeof FooterContent>) {
  return <FooterContent {...props} />;
}

export function LayoutMaterialToc({
  chapters,
  header,
  githubUrl,
  references,
  showComments,
}: {
  chapters: {
    label: string;
    data: ParsedHeading[];
  };
  header?: ComponentProps<typeof SidebarRight>["header"];
  githubUrl?: ComponentProps<typeof SidebarRight>["githubUrl"];
  references?: ComponentProps<typeof SidebarRight>["references"];
  showComments?: ComponentProps<typeof SidebarRight>["showComments"];
}) {
  return (
    <SidebarRight
      githubUrl={githubUrl}
      header={header}
      references={references}
      showComments={showComments}
    >
      <SidebarTree data={chapters.data} title={chapters.label} />
    </SidebarRight>
  );
}

export function LayoutMaterial({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex", className)} {...props} />;
}
