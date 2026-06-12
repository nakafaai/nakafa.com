"use client";

import NavigationLink from "@repo/design-system/components/navigation/link";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useUser } from "@/lib/context/use-user";

export function HeaderMenu() {
  const t = useTranslations("Metadata");
  const currentUser = useUser((state) => state.user);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          render={
            <NavigationLink
              aria-label="Nakafa"
              href={currentUser ? "/home" : "/"}
            />
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
            />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <p className="truncate font-medium">Nakafa</p>
            <span className="truncate text-xs">
              {t("very-short-description")}
            </span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
