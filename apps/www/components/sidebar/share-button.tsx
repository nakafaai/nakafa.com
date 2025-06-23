"use client";

import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { getAppUrl } from "@repo/design-system/lib/utils";
import { Share2Icon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export function ShareButton() {
  const t = useTranslations("Common");

  // use pathname hook from nextjs to get the locale
  const pathname = usePathname();

  const handleShare = () => {
    const url = `${getAppUrl()}${pathname}`;
    navigator.clipboard.writeText(url);
    toast.success(t("share-copied"), {
      description: url,
      position: "bottom-center",
    });
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={handleShare} tooltip={t("share")}>
        <Share2Icon className="size-4 shrink-0" />
        <span className="truncate">{t("share")}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
