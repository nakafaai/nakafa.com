"use client";

import NavigationLink from "@repo/design-system/components/ui/navigation-link";
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
        <SidebarMenuButton asChild size="lg">
          <NavigationLink href={currentUser ? "/" : "/about"} title="Nakafa">
            <div className="relative aspect-square size-8">
              <Image
                alt="Nakafa"
                className="rounded-sm border object-contain"
                fill
                preload
                src="/logo.svg"
                title="Nakafa"
              />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <p className="truncate font-medium">Nakafa</p>
              <span className="truncate text-xs">
                {t("very-short-description")}
              </span>
            </div>
          </NavigationLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
