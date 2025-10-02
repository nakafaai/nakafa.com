import { SiGithub } from "@icons-pack/react-simple-icons";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  githubUrl: string;
};

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
          <SiGithub className="size-4 shrink-0" />
          <span className="truncate">{t("source-code")}</span>

          <ExternalLinkIcon className="ml-auto size-4 shrink-0" />
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
