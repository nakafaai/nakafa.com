import type { IconSvgElement } from "@hugeicons/react";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cva } from "class-variance-authority";
import type { ComponentProps } from "react";

/**
 * Where a head's button stands in its line: pulled to the cell's start edge in the first column, so the column's name
 * lines up with the rows below it, and pulled to both edges in a centred column. An active head, one that sorts or
 * filters the rows, takes the muted fill.
 */
const headButton = cva(
  "min-w-0 max-w-[calc(100%+1rem)] overflow-hidden sm:max-w-[calc(100%+1.75rem)]",
  {
    defaultVariants: { active: false, align: "center" },
    variants: {
      active: { false: "", true: "bg-muted text-foreground" },
      align: { center: "-mx-2 sm:-mx-3", start: "-ml-2 sm:-ml-3" },
    },
  }
);

/**
 * The button in a table's column head that opens the column's menu, to sort the rows by it or to filter them: the
 * column's name, cut short when the column is narrow, and the menu's icon after it. Every table of Nakafa draws its
 * heads with it, the try-out tables and the School's data tables alike, so a head reads and behaves the same
 * everywhere.
 */
export function TableHeadButton({
  active = false,
  align = "center",
  children,
  icon,
  ...props
}: Omit<ComponentProps<typeof Button>, "className" | "size" | "variant"> & {
  readonly active?: boolean;
  readonly align?: "center" | "start";
  readonly icon: IconSvgElement;
}) {
  return (
    <Button
      {...props}
      className={headButton({ active, align })}
      size="sm"
      type="button"
      variant="ghost"
    >
      <span className="min-w-0 truncate">{children}</span>
      <HugeIcons data-icon="inline-end" icon={icon} />
    </Button>
  );
}
