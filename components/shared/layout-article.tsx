import type { ArticleMetadata } from "@/types/articles";
import { DramaIcon } from "lucide-react";
import type { ReactNode } from "react";
import { FooterContent } from "./footer-content";
import { HeaderContent } from "./header-content";
import { LayoutContent } from "./layout-content";
import { SidebarRight } from "./sidebar-right";
import { type ParsedHeading, SidebarTree } from "./sidebar-tree";

type Props = {
  metadata: ArticleMetadata;
  content: ReactNode;
  footer: ReactNode;
  onThisPage: ParsedHeading[];
};

export function LayoutArticle({
  metadata,
  content,
  footer,
  onThisPage,
}: Props) {
  return (
    <div className="flex">
      <div className="flex-1">
        <HeaderContent
          title={metadata.title}
          description={metadata.description}
          authors={metadata.authors}
          date={metadata.date}
          category={{
            icon: DramaIcon,
            name: metadata.category,
          }}
        />
        <LayoutContent>{content}</LayoutContent>
        <FooterContent>{footer}</FooterContent>
      </div>
      <SidebarRight>
        <SidebarTree data={onThisPage} />
      </SidebarRight>
    </div>
  );
}
