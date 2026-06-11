"use client";

import { Share01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { useClipboard } from "@mantine/hooks";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { toastManager } from "@repo/design-system/components/ui/toast";
import { getAppUrl } from "@repo/next-config/app";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export function ShareButton() {
  const t = useTranslations("Common");

  // use pathname hook from nextjs to get the locale
  const pathname = usePathname();

  const clipboard = useClipboard({ timeout: 500 });

  function handleShare() {
    const url = `${getAppUrl()}${pathname}`;
    clipboard.copy(url);
    toastManager.add({
      type: "success",
      title: t("share-copied"),
      description: url,
    });
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={handleShare} tooltip={t("share")}>
        <HugeIcons icon={clipboard.copied ? Tick01Icon : Share01Icon} />
        <span className="truncate">{t("share")}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
