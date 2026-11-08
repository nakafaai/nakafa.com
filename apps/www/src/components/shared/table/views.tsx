import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { Array as Arr, Option } from "effect";
import type { ComponentProps } from "react";

/**
 * The views of a page's list, such as its files, what the reader starred and the trash, or its live and archived
 * records: one row of joined outline segments in the body, above the list's card, as the forum's chat filters stand
 * above its chats. A page's sub-views never stand in its header, and the pressed view keeps the neutral accent, so the
 * page's primary button keeps the only primary fill. A phone gives each view an equal share of the row.
 */
export function TableViews<View extends string>({
  label,
  onChoose,
  view,
  views,
}: {
  /** The name of the choice for a screen reader. */
  label: string;
  onChoose: (view: View) => void;
  view: View;
  views: readonly {
    readonly icon: ComponentProps<typeof HugeIcons>["icon"];
    readonly label: string;
    readonly value: View;
  }[];
}) {
  return (
    <ToggleGroup
      aria-label={label}
      className="w-full shrink-0 sm:w-fit"
      onValueChange={(next) =>
        Option.map(
          Arr.findFirst(views, (shown) => shown.value === next),
          (shown) => onChoose(shown.value)
        )
      }
      value={view}
    >
      {Arr.map(views, (shown) => (
        <ToggleGroupItem key={shown.value} value={shown.value}>
          <HugeIcons aria-hidden="true" icon={shown.icon} />
          {shown.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
