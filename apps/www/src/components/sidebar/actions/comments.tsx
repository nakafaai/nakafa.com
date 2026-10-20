import { MessageMultiple01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { HrefLink } from "@repo/internationalization/src/link";
import { useTranslations } from "use-intl";

export function CommentsButton() {
  const t = useTranslations("Common");

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<HrefLink href="#comments" title={t("comments")} />}
        tooltip={t("comments")}
      >
        <HugeIcons className="shrink-0" icon={MessageMultiple01Icon} />
        <span className="truncate">{t("comments")}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
