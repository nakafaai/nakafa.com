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
      className="sticky top-16 hidden h-[calc(100svh-4rem)] border-l xl:flex"
      {...props}
    >
      <SidebarContent>{children}</SidebarContent>
    </Sidebar>
  );
}
