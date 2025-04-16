import { cn } from "@/lib/utils";
import type { ContentMetadata, ContentPagination } from "@/types/content";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { FooterContent } from "./footer-content";
import { HeaderContent } from "./header-content";
import { LayoutContent } from "./layout-content";
import { PaginationContent } from "./pagination-content";
import { SidebarRight } from "./sidebar-right";
import { type ParsedHeading, SidebarTree } from "./sidebar-tree";

type Props = {
  header: {
    title: string;
    icon?: LucideIcon;
    link?: {
      href: string;
      label: string;
    };
  };
  content: ReactNode;
  chapters: {
    label?: string;
    data: ParsedHeading[];
  };
  githubUrl: string;
  footerClassName?: string;
  contentClassName?: string;
  category?: {
    icon: LucideIcon;
    name: string;
  };
  metadata?: ContentMetadata;
  pagination?: ContentPagination;
};

export function LayoutMaterialHeader({
  header,
  metadata,
  category,
}: {
  header: Props["header"];
  metadata?: Props["metadata"];
  category?: Props["category"];
}) {
  return (
    <HeaderContent
      title={header.title}
      icon={header.icon}
      link={header.link}
      description={metadata?.description}
      category={category}
      date={metadata?.date}
      authors={metadata?.authors}
    />
  );
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
  pagination,
}: {
  pagination: Props["pagination"];
}) {
  if (!pagination) {
    return null;
  }
  return <PaginationContent pagination={pagination} />;
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
  chapters: Props["chapters"];
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
