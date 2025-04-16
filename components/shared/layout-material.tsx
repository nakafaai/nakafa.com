import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
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

export function LayoutMaterial({
  children,
  chapters,
}: {
  children: ReactNode;
  chapters: {
    label?: string;
    data: ParsedHeading[];
  };
}) {
  const t = useTranslations("Subject");

  return (
    <div className="lg:flex">
      <div className="flex-1">{children}</div>
      <SidebarRight>
        <SidebarTree
          title={chapters.label ?? t("chapter")}
          data={chapters.data}
        />
      </SidebarRight>
    </div>
  );
}
