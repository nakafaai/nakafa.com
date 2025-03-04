import type { ComponentProps, ReactNode } from "react";
import { Sidebar, SidebarContent } from "../ui/sidebar";

type Props = {
  children: ReactNode;
} & ComponentProps<typeof Sidebar>;

export function SidebarRight({ children, ...props }: Props) {
  return (
    <Sidebar
      data-pagefind-ignore
      collapsible="none"
      className="sticky top-16 hidden h-svh border-l lg:flex"
      {...props}
    >
      <SidebarContent>{children}</SidebarContent>
    </Sidebar>
  );
}
