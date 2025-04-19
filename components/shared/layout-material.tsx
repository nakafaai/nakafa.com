import { cn } from "@/lib/utils";
import type { ComponentProps, ReactNode } from "react";
import { FooterContent } from "./footer-content";
import { HeaderContent } from "./header-content";
import { LayoutContent } from "./layout-content";
import { PaginationContent } from "./pagination-content";
import { SidebarRight } from "./sidebar-right";
import { type ParsedHeading, SidebarTree } from "./sidebar-tree";

export function LayoutMaterialHeader({
  ...props
}: ComponentProps<typeof HeaderContent>) {
  return <HeaderContent {...props} />;
}

export function LayoutMaterialContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("flex-1", className)}>{children}</div>;
}

export function LayoutMaterialMain({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <LayoutContent className={className}>{children}</LayoutContent>;
}

export function LayoutMaterialPagination({
  ...props
}: ComponentProps<typeof PaginationContent>) {
  return <PaginationContent {...props} />;
}

export function LayoutMaterialFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <FooterContent className={cn("mt-0", className)}>{children}</FooterContent>
  );
}

export function LayoutMaterialTableOfContents({
  chapters,
  header,
}: {
  chapters: {
    label: string;
    data: ParsedHeading[];
  };
  header?: ComponentProps<typeof SidebarRight>["header"];
}) {
  return (
    <SidebarRight header={header}>
      <SidebarTree title={chapters.label} data={chapters.data} />
    </SidebarRight>
  );
}

export function LayoutMaterial({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="lg:flex">{children}</div>;
}
