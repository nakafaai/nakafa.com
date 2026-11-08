import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@repo/design-system/components/ui/item";
import type { ComponentProps, ReactNode } from "react";

/**
 * The body of a class's confirmation: the record the action takes away, with the icon of its kind, its name, and what
 * goes with it, so the dialog shows what is lost instead of saying it again under its title.
 */
export function LossItem({
  detail,
  icon,
  name,
}: {
  /** What goes with the record, such as the work handed in to a task. */
  detail?: ReactNode;
  icon: ComponentProps<typeof HugeIcons>["icon"];
  name: ReactNode;
}) {
  return (
    <Item size="sm" variant="outline">
      <ItemMedia variant="icon">
        <HugeIcons aria-hidden="true" icon={icon} />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="line-clamp-3 wrap-anywhere" dir="auto">
          {name}
        </ItemTitle>
        {detail === undefined ? null : (
          <ItemDescription>{detail}</ItemDescription>
        )}
      </ItemContent>
    </Item>
  );
}
