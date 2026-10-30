import { PanelLeftIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { SidebarFooter } from "@repo/design-system/components/ui/sidebar-content";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { useSidebar } from "@repo/design-system/lib/sidebar/context";
import { useTranslations } from "use-intl";

/**
 * The sidebar's own toggle, in both apps, at its foot above the account: it folds the
 * sidebar into a rail of its icons, where every entry keeps its tooltip, and opens it
 * again. Below the desktop width the sidebar is a sheet that the page header's toggle
 * opens, so this row shows only beside the page.
 */
export function SidebarToggle() {
  const t = useTranslations("Common");
  const open = useSidebar((sidebar) => sidebar.open);
  const toggleSidebar = useSidebar((sidebar) => sidebar.toggleSidebar);
  const label = t("toggle-sidebar");

  return (
    <SidebarFooter className="border-t max-lg:hidden">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            aria-expanded={open}
            onClick={toggleSidebar}
            tooltip={label}
          >
            <HugeIcons icon={PanelLeftIcon} />
            <span>{label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
}
