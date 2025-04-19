"use client";

import { IconMenu } from "@tabler/icons-react";
import type { CSSProperties, ComponentProps, ReactNode } from "react";
import { useMediaQuery } from "usehooks-ts";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { SIDEBAR_WIDTH_MOBILE, Sidebar, SidebarContent } from "../ui/sidebar";

type Props = {
  children: ReactNode;
} & ComponentProps<typeof Sidebar>;

export function SidebarRight({ children, ...props }: Props) {
  const isMobile = useMediaQuery("(max-width: 1280px)"); // xl

  if (isMobile) {
    // this is basically mimic the sidebar component
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="fixed top-[78px] right-6 bg-background/60 backdrop-blur-sm"
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
          data-pagefind-ignore
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Sidebar Right</SheetTitle>
            <SheetDescription>
              Displays the mobile sidebar right.
            </SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">
            <SidebarContent>{children}</SidebarContent>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sidebar
      data-pagefind-ignore
      collapsible="none"
      className="sticky top-16 hidden h-[calc(100svh-4rem)] border-l xl:flex"
      side="right"
      {...props}
    >
      <SidebarContent>{children}</SidebarContent>
    </Sidebar>
  );
}
