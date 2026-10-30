import { CommandIcon, Search02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";

/**
 * The search row at the head of a sidebar, in both apps: the palette's placeholder,
 * and its keys on a wide screen. A press opens the palette, and intent warms it.
 */
export function SidebarSearchButton({
  label,
  onIntent,
  onOpen,
  open,
}: {
  label: string;
  onIntent: () => void;
  onOpen: () => void;
  open: boolean;
}) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          className="justify-between text-muted-foreground"
          isActive={open}
          onClick={onOpen}
          onFocus={onIntent}
          onMouseEnter={onIntent}
          onTouchStart={onIntent}
          tooltip={label}
          variant="outline"
        >
          <div className="flex items-center gap-2">
            <HugeIcons className="size-4" icon={Search02Icon} />
            <span>{label}</span>
          </div>
          <div className="hidden items-center lg:flex">
            <kbd className="rounded">
              <HugeIcons className="size-3.5 shrink-0" icon={CommandIcon} />
              <span className="sr-only">Command/Ctrl</span>
            </kbd>
            <kbd className="rounded">K</kbd>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
