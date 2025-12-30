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
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { AboutMenu } from "./about-menu";
import { CommunityButton } from "./community-button";
import { LangMenu } from "./lang-menu";
import { NavArticles } from "./nav-articles";
import { NavExercises } from "./nav-exercises";
import { NavHoly } from "./nav-holy";
import { NavSubject } from "./nav-subject";
import { NavUser } from "./nav-user";
import { SearchMenu } from "./search-menu";
import { ThemeMenu } from "./theme-menu";

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const t = useTranslations("Metadata");

  return (
    <Sidebar
      className={cn("z-20", props.className)}
      side="left"
      variant="floating"
      {...props}
    >
      <SidebarHeader className="border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <NavigationLink href="/" title="Nakafa">
                <div className="relative aspect-square size-8">
                  <Image
                    alt="Nakafa"
                    className="rounded-sm border object-contain"
                    fetchPriority="high"
                    fill
                    loading="eager"
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
        <SearchMenu />
      </SidebarHeader>
      <SidebarContent>
        <NavSubject />
        <NavExercises />
        <NavHoly />
        <NavArticles />
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <LangMenu />
          <ThemeMenu />
          <CommunityButton />
          <AboutMenu />
          <NavUser />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
