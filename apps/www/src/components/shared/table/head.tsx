import type { IconSvgElement } from "@hugeicons/react";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cva } from "class-variance-authority";
import { type ComponentProps, use } from "react";
import {
  type HeadAlign,
  HeadAlignContext,
} from "@/components/shared/table/align";

/**
 * Where a head's button stands in its line: pulled out by its own padding in the first column, so the column's name
 * lines up with the rows below it, in the last column of figures, so its icon ends where they end, and to both edges in
 * a centred column. An active head, one that sorts or filters the rows, takes the accent fill over the muted head row.
 */
const headButton = cva(
  "max-w-[calc(100%+1rem)] min-w-0 overflow-hidden sm:max-w-[calc(100%+1.75rem)]",
  {
    defaultVariants: { active: false, align: "center" },
    variants: {
      active: { false: "", true: "bg-accent text-accent-foreground" },
      align: {
        center: "-mx-2 sm:-mx-3",
        end: "-mr-2.5",
        start: "-ml-2.5",
      },
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
  align,
  children,
  icon,
  ...props
}: Omit<ComponentProps<typeof Button>, "className" | "size" | "variant"> & {
  readonly active?: boolean;
  readonly align?: typeof HeadAlign.Type;
  readonly icon: IconSvgElement;
}) {
  const placed = use(HeadAlignContext);

  return (
    <Button
      {...props}
      className={headButton({ active, align: align ?? placed })}
      size="sm"
      type="button"
      variant="ghost"
    >
      <span className="min-w-0 truncate">{children}</span>
      <HugeIcons data-icon="inline-end" icon={icon} />
    </Button>
  );
}
