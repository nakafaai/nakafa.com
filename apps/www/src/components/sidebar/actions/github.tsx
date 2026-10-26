import { GithubIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { useTranslations } from "use-intl";

interface Props {
  githubUrl: string;
}

export function GithubButton({ githubUrl }: Props) {
  const t = useTranslations("Common");
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={
          <a
            aria-label={t("source-code")}
            href={githubUrl}
            rel="noopener noreferrer"
            target="_blank"
            title={t("source-code")}
          >
            <HugeIcons className="size-4 shrink-0" icon={GithubIcon} />
            <span className="truncate">{t("source-code")}</span>
          </a>
        }
        tooltip={t("source-code")}
      />
    </SidebarMenuItem>
  );
}
