import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@repo/design-system/components/ui/sidebar-content";
import { SidebarMenu } from "@repo/design-system/components/ui/sidebar-menu";
import { Sidebar } from "@repo/design-system/components/ui/sidebar-shell";
import { cn } from "@repo/design-system/lib/utils";
import { Effect } from "effect";
import { type ComponentProps, Suspense } from "react";
import { SchoolSidebarNavLearning } from "@/components/school/sidebar/learning";
import { SchoolSwitcher } from "@/components/school/sidebar/switcher";
import { SchoolSidebarNavUser } from "@/components/school/sidebar/user";
import { SchoolSidebarNavYours } from "@/components/school/sidebar/yours";
import { getToken } from "@/lib/auth/server";
import { getSchoolSwitcherPage } from "@/lib/school/server";

/** Render the School sidebar shell while the switcher data streams independently. */
export function SchoolSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar className={cn("z-20", props.className)} side="left" {...props}>
      <SidebarHeader className="border-b">
        <Suspense fallback={null}>
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
  const token = await getToken();
  const initialSchoolPage = await Effect.runPromise(
    getSchoolSwitcherPage(token)
  );

  return <SchoolSwitcher initialSchoolPage={initialSchoolPage} />;
}
