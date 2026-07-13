import { SchoolIcon, UnfoldMoreIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@repo/design-system/components/ui/sidebar-content";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { Sidebar } from "@repo/design-system/components/ui/sidebar-shell";
import { cn } from "@repo/design-system/lib/utils";
import { type ComponentProps, Suspense } from "react";
import { SchoolSidebarNavLearning } from "@/components/school/sidebar/nav-learning";
import { SchoolSidebarNavUser } from "@/components/school/sidebar/nav-user";
import { SchoolSidebarNavYours } from "@/components/school/sidebar/nav-yours";
import { SchoolSwitcher } from "@/components/school/sidebar/school-switcher";
import { getSchoolSwitcherPage } from "@/lib/school/server";

/** Render the School sidebar shell while the switcher data streams independently. */
export function SchoolSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar className={cn("z-20", props.className)} side="left" {...props}>
      <SidebarHeader className="border-b">
        <Suspense fallback={<SchoolSwitcherFallback />}>
          <SchoolSwitcherSlot />
        </Suspense>
      </SidebarHeader>
      <SidebarContent>
        <SchoolSidebarNavYours />
        <SchoolSidebarNavLearning />
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SchoolSidebarNavUser />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

/** Load the first school switcher page without blocking the surrounding sidebar. */
async function SchoolSwitcherSlot() {
  const initialSchoolPage = await getSchoolSwitcherPage();

  return <SchoolSwitcher initialSchoolPage={initialSchoolPage} />;
}

/** Match the school switcher trigger shape while its server page is loading. */
function SchoolSwitcherFallback() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          aria-hidden="true"
          className="disabled:opacity-100"
          disabled
          size="lg"
        >
          <div className="flex aspect-square size-8 items-center justify-center rounded-sm border bg-foreground text-background">
            <HugeIcons className="size-4" icon={SchoolIcon} />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <p className="truncate font-medium">Nakafa</p>
            <span className="truncate text-xs">School</span>
          </div>
          <HugeIcons className="ml-auto" icon={UnfoldMoreIcon} />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
