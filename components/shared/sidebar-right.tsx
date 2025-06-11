import { MenuIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { ReportButton } from "../sidebar/report-button";
import { ShareButton } from "../sidebar/share-button";
import NavigationLink from "../ui/navigation-link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "../ui/sidebar";
import { TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Tooltip } from "../ui/tooltip";

export type SidebarRightProps = {
  children: ReactNode;
  header?: {
    title: string;
    href: string;
    description?: string;
  };
} & ComponentProps<typeof Sidebar>;

function SidebarRightHeader({
  header,
}: { header: SidebarRightProps["header"] }) {
  if (!header) {
    return null;
  }

  return (
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarMenuButton size="lg" asChild>
                <NavigationLink href={header.href} title={header.title}>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {header.title}
                    </span>
                    {header.description && (
                      <span className="truncate text-xs">
                        {header.description}
                      </span>
                    )}
                  </div>
                </NavigationLink>
              </SidebarMenuButton>
            </TooltipTrigger>
            <TooltipContent
              side="left"
              align="center"
              className="hidden max-w-xs sm:block"
            >
              {header.title}
            </TooltipContent>
          </Tooltip>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
}

function SidebarRightFooter() {
  return (
    <SidebarFooter className="border-t">
      <SidebarMenu>
        <ReportButton />
        <ShareButton />
      </SidebarMenu>
    </SidebarFooter>
  );
}

export function SidebarRight({
  children,
  header,
  ...props
}: SidebarRightProps) {
  return (
    <div data-pagefind-ignore>
      <SidebarProvider
        sidebarDesktop={1280}
        keyboardShortcut="x"
        cookieName="sidebar_state:right"
      >
        {/* Mobile trigger button */}
        <SidebarTrigger
          variant="outline"
          size="icon"
          className="fixed top-20 right-6 size-8 bg-background/30 backdrop-blur-xs xl:hidden"
          icon={<MenuIcon />}
        />

        {/* Right sidebar */}
        <Sidebar
          side="right"
          variant="floating"
          containerClassName="lg:hidden xl:block"
          {...props}
        >
          <SidebarRightHeader header={header} />
          <SidebarContent>{children}</SidebarContent>
          <SidebarRightFooter />
        </Sidebar>
      </SidebarProvider>
    </div>
  );
}
