import {
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@repo/design-system/components/ui/sidebar";

/**
 * Renders a stable user-menu placeholder while Convex auth and profile data
 * settle.
 */
export function NavUserSkeleton() {
  return (
    <SidebarMenuItem>
      <SidebarMenuSkeleton className="h-12" showIcon />
    </SidebarMenuItem>
  );
}
