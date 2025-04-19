import { IconMenu } from "@tabler/icons-react";
import type {
  CSSProperties,
  ComponentProps,
  ComponentType,
  ReactNode,
  SVGProps,
} from "react";
import { Button } from "../ui/button";
import NavigationLink from "../ui/navigation-link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import {
  SIDEBAR_WIDTH_MOBILE,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";
import { TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Tooltip } from "../ui/tooltip";

export type SidebarRightProps = {
  children: ReactNode;
  header?: {
    title: string;
    href: string;
    description?: string;
    icon?: ComponentType<SVGProps<SVGSVGElement>>;
  };
} & ComponentProps<typeof Sidebar>;

function SidebarRightHeader({
  header,
}: { header: SidebarRightProps["header"] }) {
  if (!header) {
    return null;
  }

  return (
    <SidebarHeader className="border-b">
      <SidebarMenu>
        <SidebarMenuItem>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarMenuButton size="lg" asChild>
                <NavigationLink href={header.href}>
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

export function SidebarRight({
  children,
  header,
  ...props
}: SidebarRightProps) {
  return (
    <div data-pagefind-ignore>
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="fixed top-20 right-6 size-8 bg-background/60 backdrop-blur-sm xl:hidden"
          >
            <IconMenu />
            <span className="sr-only">Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent
          data-sidebar="sidebar-right"
          data-slot="sidebar-right"
          data-mobile="true"
          className="w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
            } as CSSProperties
          }
          side="right"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Sidebar Right</SheetTitle>
            <SheetDescription>
              Displays the mobile sidebar right.
            </SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">
            <SidebarRightHeader header={header} />
            <SidebarContent>{children}</SidebarContent>
          </div>
        </SheetContent>
      </Sheet>

      <Sidebar
        collapsible="none"
        className="sticky top-16 hidden h-[calc(100svh-4rem)] border-l xl:flex"
        side="right"
        {...props}
      >
        <SidebarRightHeader header={header} />
        <SidebarContent>{children}</SidebarContent>
      </Sidebar>
    </div>
  );
}
