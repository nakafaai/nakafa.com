import { Search02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { useSidebar } from "@repo/design-system/lib/sidebar/context";
import { SearchShortcut } from "@/components/search/shortcut";

/**
 * The search row at the head of a sidebar, in both apps: the palette's placeholder,
 * and its keys on a wide screen. A press opens the palette, and intent warms it.
 * The placeholder keeps one line and clips as the sidebar folds, like every
 * other row's label, so it never wraps while the row narrows. The rail keeps the
 * row's icon alone, so the keys never crowd it in the round button. On a phone
 * the sheet steps aside for the palette, as it does for a link, so a result opens
 * on the page and closing the palette returns to the page.
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
  const setOpenMobile = useSidebar((sidebar) => sidebar.setOpenMobile);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          className="text-muted-foreground justify-between"
          isActive={open}
          onClick={() => {
            setOpenMobile(false);
            onOpen();
          }}
          onFocus={onIntent}
          onMouseEnter={onIntent}
          onTouchStart={onIntent}
          tooltip={label}
          variant="outline"
        >
          <div className="flex min-w-0 items-center gap-2">
            <HugeIcons className="size-4 shrink-0" icon={Search02Icon} />
            <span className="truncate">{label}</span>
          </div>
          <SearchShortcut className="hidden shrink-0 group-data-[collapsible=icon]:hidden lg:inline-flex" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
