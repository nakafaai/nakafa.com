"use client";

import { useClipboard } from "@mantine/hooks";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { getAppUrl } from "@repo/design-system/lib/utils";
import { CheckIcon, Share2Icon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export function ShareButton() {
  const t = useTranslations("Common");

  // use pathname hook from nextjs to get the locale
  const pathname = usePathname();

  const clipboard = useClipboard({ timeout: 500 });

  function handleShare() {
    const url = `${getAppUrl()}${pathname}`;
    clipboard.copy(url);
    toast.success(t("share-copied"), {
      description: url,
      position: "bottom-center",
    });
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={handleShare} tooltip={t("share")}>
        {clipboard.copied ? <CheckIcon /> : <Share2Icon />}
        <span className="truncate">{t("share")}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
