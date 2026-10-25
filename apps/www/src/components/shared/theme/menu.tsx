import { DropdownMenuContent } from "@repo/design-system/components/ui/dropdown-menu";
import { ThemeMenuItems } from "@/components/shared/theme/items";

/** Renders the theme list of the theme picker. */
export function ThemeMenuContent() {
  return (
    <DropdownMenuContent
      align="end"
      className="max-h-[min(var(--available-height),24rem)] w-max max-w-[calc(100vw-2rem)]"
    >
      <ThemeMenuItems />
    </DropdownMenuContent>
  );
}
