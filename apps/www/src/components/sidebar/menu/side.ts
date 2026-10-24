import type { SidebarContextValue } from "@repo/design-system/lib/sidebar/context";

/**
 * Opens menus beside the sidebar, or above their trigger on phones, where the
 * sidebar fills the screen.
 */
export function selectMenuSide(sidebar: Pick<SidebarContextValue, "isMobile">) {
  return sidebar.isMobile ? "top" : "right";
}
