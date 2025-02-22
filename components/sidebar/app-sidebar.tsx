import { Link } from "@/i18n/routing";
import nakafaLogo from "@/public/logo.svg";
import { useTranslations } from "next-intl";
import Image from "next/image";
import type { ComponentProps } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "../ui/sidebar";
import { AboutMenu } from "./about-menu";
import { ThemeMenu } from "./theme-menu";

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const t = useTranslations("Metadata");

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/">
              <SidebarMenuButton
                size="lg"
                className="cursor-pointer data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <div className="relative flex aspect-square size-8 items-center justify-center rounded-lg border">
                  <Image
                    src={nakafaLogo}
                    alt="Nakafa"
                    fill
                    priority
                    className="rounded-lg object-contain"
                  />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Nakafa</span>
                  <span className="truncate text-xs">
                    {t("short-description")}
                  </span>
                </div>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent />
      <SidebarFooter>
        <SidebarMenu>
          <ThemeMenu />
          <AboutMenu />
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
