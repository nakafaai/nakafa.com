import type { ParsedHeading } from "@repo/contents/_types/toc";
import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps, ReactNode } from "react";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { PaginationContent } from "@/components/shared/pagination-content";
import { SidebarRight } from "@/components/shared/sidebar-right";
import { SidebarTree } from "@/components/shared/sidebar-tree";

interface LayoutMaterialTocProps {
  chapters: {
    label: string;
    data: ParsedHeading[];
  };
  githubUrl?: ComponentProps<typeof SidebarRight>["githubUrl"];
  header?: ComponentProps<typeof SidebarRight>["header"];
  references?: ComponentProps<typeof SidebarRight>["references"];
  showComments?: ComponentProps<typeof SidebarRight>["showComments"];
}

/**
 * Renders the flex shell shared by article, subject, exercise, and Quran pages.
 */
export function LayoutMaterial({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex", className)} {...props} />;
}

/**
 * Renders the material page header through the shared header adapter.
 */
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

/**
 * Renders the primary readable content area for material pages.
 */
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

/**
 * Renders previous and next material navigation.
 */
export function LayoutMaterialPagination({
  ...props
}: ComponentProps<typeof PaginationContent>) {
  return <PaginationContent {...props} />;
}

/**
 * Renders the material page footer through the shared footer adapter.
 */
export function LayoutMaterialFooter({
  ...props
}: ComponentProps<typeof FooterContent>) {
  return <FooterContent {...props} />;
}

/**
 * Renders the right-hand table of contents and material page actions.
 */
export function LayoutMaterialToc({
  chapters,
  header,
  githubUrl,
  references,
  showComments,
}: LayoutMaterialTocProps) {
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
