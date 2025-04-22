"use client";

import { getAppUrl } from "@/lib/utils";
import { Share2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { SidebarMenuButton } from "../ui/sidebar";
import { SidebarMenuItem } from "../ui/sidebar";

export function ShareButton() {
  const t = useTranslations("Common");

  // use pathname hook from nextjs to get the locale
  const pathname = usePathname();

  const handleShare = () => {
    navigator.clipboard.writeText(`${getAppUrl()}${pathname}`);
    toast.success(t("share-copied"));
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton tooltip={t("share")} onClick={handleShare}>
        <Share2Icon className="size-4 shrink-0" />
        <span className="truncate">{t("share")}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
