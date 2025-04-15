import type { ContentMetadata } from "@/types/content";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { FooterContent } from "./footer-content";
import { HeaderContent } from "./header-content";
import { LayoutContent } from "./layout-content";
import { SidebarRight } from "./sidebar-right";
import { type ParsedHeading, SidebarTree } from "./sidebar-tree";

export function LayoutArticleHeader({
  metadata,
  icon,
}: { icon: LucideIcon; metadata: ContentMetadata }) {
  return (
    <HeaderContent
      title={metadata.title}
      description={metadata.description}
      authors={metadata.authors}
      date={metadata.date}
      category={{
        icon,
        name: metadata.category,
      }}
    />
  );
}

export function LayoutArticleContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <LayoutContent className={className}>{children}</LayoutContent>;
}

export function LayoutArticleFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <FooterContent className={className}>{children}</FooterContent>;
}

export function LayoutArticle({
  children,
  onThisPage,
}: {
  children: ReactNode;
  onThisPage: ParsedHeading[];
}) {
  return (
    <div className="lg:flex">
      <div className="flex-1">{children}</div>
      <SidebarRight>
        <SidebarTree data={onThisPage} />
      </SidebarRight>
    </div>
  );
}
