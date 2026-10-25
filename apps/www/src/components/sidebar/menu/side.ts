import type { SidebarContextValue } from "@repo/design-system/lib/sidebar/context";

/**
 * Opens menus beside the sidebar, or above their trigger on phones, where the
 * sidebar fills the screen. Beside means the inline end, so a right-to-left page
 * opens them on its left without a second rule.
 */
export function selectMenuSide(sidebar: Pick<SidebarContextValue, "isMobile">) {
  return sidebar.isMobile ? "top" : "inline-end";
}
