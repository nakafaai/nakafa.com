import type { ComponentProps, ReactNode } from "react";
import { FooterContent } from "./footer-content";
import { HeaderContent } from "./header-content";
import { LayoutContent } from "./layout-content";
import { SidebarRight } from "./sidebar-right";
import { type ParsedHeading, SidebarTree } from "./sidebar-tree";

export function LayoutArticleHeader({
  ...props
}: ComponentProps<typeof HeaderContent>) {
  return <HeaderContent {...props} />;
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
