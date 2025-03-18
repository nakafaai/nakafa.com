import type { MaterialList } from "@/types/subjects";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { CardMaterial } from "./card-material";
import { ContainerList } from "./container-list";
import { FooterContent } from "./footer-content";
import { HeaderContent } from "./header-content";
import { LayoutContent } from "./layout-content";
import { RefContent } from "./ref-content";
import { SidebarRight } from "./sidebar-right";
import { type ParsedHeading, SidebarTree } from "./sidebar-tree";

type Props = {
  header: {
    title: string;
    icon: LucideIcon;
    link: {
      href: string;
      label: string;
    };
  };
  materials: MaterialList[];
  chapters: ParsedHeading[];
  githubUrl: string;
};

export function LayoutMaterial({
  header,
  materials,
  chapters,
  githubUrl,
}: Props) {
  const t = useTranslations("Subject");

  return (
    <div className="flex">
      <div className="flex-1">
        <HeaderContent
          title={header.title}
          icon={header.icon}
          link={header.link}
        />
        <LayoutContent className="py-10">
          <ContainerList className="sm:grid-cols-1">
            {materials.map((material) => (
              <CardMaterial key={material.title} material={material} />
            ))}
          </ContainerList>
        </LayoutContent>
        <FooterContent className="mt-0">
          <RefContent githubUrl={githubUrl} />
        </FooterContent>
      </div>
      <SidebarRight>
        <SidebarTree title={t("chapter")} data={chapters} />
      </SidebarRight>
    </div>
  );
}
