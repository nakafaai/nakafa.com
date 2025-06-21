import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import Image from "next/image";
import type { ComponentProps } from "react";
import { AboutMenu } from "./about-menu";
import { CommunityButton } from "./community-button";
import { LangMenu } from "./lang-menu";
import { NavArticles } from "./nav-articles";
import { NavSubject } from "./nav-subject";
import { SearchMenu } from "./search-menu";
import { ThemeMenu } from "./theme-menu";

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const t = useTranslations("Metadata");

  return (
    <Sidebar
      variant="floating"
      side="left"
      className={cn("z-20", props.className)}
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="cursor-pointer data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              asChild
            >
              <NavigationLink href="/" title="Nakafa">
                <div className="relative aspect-square size-8">
                  <Image
                    src="/logo.svg"
                    alt="Nakafa"
                    title="Nakafa"
                    fill
                    priority
                    className="rounded-lg border object-contain"
                  />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Nakafa</span>
                  <span className="truncate text-xs">
                    {t("very-short-description")}
                  </span>
                </div>
              </NavigationLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SearchMenu />
        <NavSubject />
        <NavArticles />
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <LangMenu />
          <ThemeMenu />
          <CommunityButton />
          <AboutMenu />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
