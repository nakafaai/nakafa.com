import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";

/**
 * Shows a neutral pending row until authentication settles for a guest.
 */
export function NavUserSkeleton() {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton aria-hidden disabled size="lg">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="h-4 w-28" />
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/**
 * Mirrors the account trigger while a confirmed user's profile data settles.
 */
export function NavUserAccountSkeleton() {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton aria-hidden disabled size="lg">
        <Skeleton className="aspect-square size-8 rounded-md" />
        <div className="grid min-w-0 flex-1 gap-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-14" />
        </div>
        <Skeleton className="ml-auto size-4 rounded-full" />
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
