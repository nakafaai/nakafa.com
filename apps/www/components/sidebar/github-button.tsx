import { Github01Icon, LinkSquare02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { useTranslations } from "next-intl";

interface Props {
  githubUrl: string;
}

export function GithubButton({ githubUrl }: Props) {
  const t = useTranslations("Common");
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={t("source-code")}>
        <a
          href={githubUrl}
          rel="noopener noreferrer"
          target="_blank"
          title={t("source-code")}
        >
          <HugeIcons className="size-4 shrink-0" icon={Github01Icon} />
          <span className="truncate">{t("source-code")}</span>

          <HugeIcons
            className="ml-auto size-4 shrink-0"
            icon={LinkSquare02Icon}
          />
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
