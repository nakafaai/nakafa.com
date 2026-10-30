import { PanelLeftIcon, PanelRightIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { SidebarFooter } from "@repo/design-system/components/ui/sidebar-content";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { useSidebar } from "@repo/design-system/lib/sidebar/context";
import { cva } from "class-variance-authority";
import { useTranslations } from "use-intl";

/**
 * Where the toggle shows: beside the page only, from the width at which its
 * sidebar stands beside the page. The app's sidebar does from 1024 px, and the
 * panels on the right side of a page do from 1280 px.
 */
const toggleVariants = cva("border-t", {
  variants: {
    side: {
      left: "max-lg:hidden",
      right: "max-xl:hidden",
    },
  },
});

/**
 * A sidebar's own toggle, at its foot in its own section: it folds the sidebar
 * into a rail of its icons, where every entry keeps its tooltip, and opens it
 * again. The app's sidebar keeps it above the account, and a panel on the right
 * side of a page names it after the panel. Below the width at which the sidebar
 * stands beside the page it is a sheet that the page header's toggle opens, so
 * this row shows only beside the page.
 */
export function SidebarToggle({
  label,
  side = "left",
}: {
  /** The name of a panel on the right side of a page; the app's sidebar keeps the common name. */
  label?: string;
  side?: "left" | "right";
}) {
  const t = useTranslations("Common");
  const open = useSidebar((sidebar) => sidebar.open);
  const toggleSidebar = useSidebar((sidebar) => sidebar.toggleSidebar);
  const name = label ?? t("toggle-sidebar");

  return (
    <SidebarFooter className={toggleVariants({ side })}>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            aria-expanded={open}
            onClick={toggleSidebar}
            tooltip={name}
          >
            <HugeIcons
              icon={side === "left" ? PanelLeftIcon : PanelRightIcon}
            />
            <span>{name}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
}
