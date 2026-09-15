"use client";

import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuDescription,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useViewer } from "@/lib/identity/client";

export function HeaderMenu() {
  const t = useTranslations("Metadata");
  const currentUser = useViewer((state) => state.account);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          render={
            <NavigationLink href={currentUser ? "/home" : "/"} title="Nakafa" />
          }
          size="lg"
        >
          <div className="relative aspect-square size-8">
            <Image
              alt="Nakafa"
              className="rounded-sm border object-contain"
              fill
              preload
              sizes="32px"
              src="/logo.svg"
              title="Nakafa"
            />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <p className="truncate font-medium">Nakafa</p>
            <SidebarMenuDescription>
              {t("very-short-description")}
            </SidebarMenuDescription>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
