import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@repo/design-system/components/ui/sidebar";
import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps } from "react";

export function FinanceSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar className={cn("z-20", props.className)} side="left" {...props}>
      <SidebarHeader className="border-b" />
      <SidebarContent />
      <SidebarFooter className="border-t" />
    </Sidebar>
  );
}
