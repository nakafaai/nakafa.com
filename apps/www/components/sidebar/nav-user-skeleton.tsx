import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";

/**
 * Mirrors the final sidebar user trigger layout while auth and profile data
 * settle so the footer never changes height during hydration.
 */
export function NavUserSkeleton() {
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
