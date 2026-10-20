"use client";

import { Share01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { useClipboard } from "@mantine/hooks";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { toast } from "@repo/design-system/lib/toast/notify";
import { toPublicPath } from "@repo/internationalization/src/rewrite";
import { getAppUrl } from "@repo/site/app";
import { useLocation } from "@tanstack/react-router";
import { useTranslations } from "use-intl";

export function ShareButton() {
  const t = useTranslations("Common");

  // The copied link is the public path of the page, locale included.
  const pathname = useLocation({
    select: (location) => toPublicPath(location.pathname),
  });

  const clipboard = useClipboard({ timeout: 500 });

  function handleShare() {
    const url = `${getAppUrl()}${pathname}`;
    clipboard.copy(url);
    // The link is on the clipboard, so the toast says only that it was copied:
    // a URL is not a dictionary message, and a long one takes more than two lines.
    toast.success(
      { title: "link-copied.title" },
      { position: "bottom-center" }
    );
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
