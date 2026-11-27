import { Badge } from "@repo/design-system/components/ui/badge";
import {
  HugeIcons,
  OptionIcon,
} from "@repo/design-system/components/ui/huge-icons";
import type { StatusTone } from "@repo/design-system/lib/status";
import {
  BAND_STATUS_BADGES,
  STATUS_BADGES,
} from "@repo/design-system/lib/status";
import { Array as Arr } from "effect";
import type { ComponentProps } from "react";
import type { ColumnOption } from "@/components/shared/table/columns";

/**
 * How one state of a table looks: its own icon and its tone, as `TableStatus` draws them. A table's
 * map of its states to their looks is typed by this, so the shape has one owner.
 */
export type StatusLook = Pick<
  ComponentProps<typeof TableStatus>,
  "icon" | "tone"
>;

/**
 * A record's status in a table cell, as the try-out catalog shows a try-out's: a badge in the
 * tone of the state, with the state's own icon and its name. Every state of one table takes an
 * icon of its own, so no two states of the table share one. The badge keeps one line, and a name longer than its
 * column ends in an ellipsis (`TableValue`).
 */
export function TableStatus({
  band = false,
  icon,
  label,
  tone,
}: {
  /** Whether the badge stands on a muted band, such as a pane's footer, where a muted fill would melt away. */
  band?: boolean;
  /** The icon of the state, which no other state of the table uses. */
  icon: ComponentProps<typeof HugeIcons>["icon"];
  /** The name of the state, as the reader sees it. */
  label: string;
  tone: typeof StatusTone.Type;
}) {
  return (
    <Badge variant={band ? BAND_STATUS_BADGES[tone] : STATUS_BADGES[tone]}>
      <HugeIcons data-icon="inline-start" icon={icon} />
      <span className="truncate">{label}</span>
    </Badge>
  );
}

/**
 * The room of a column of status badges, under its head: every value the column can hold, drawn as the badge its cells
 * draw and hidden. A badge names its state in a smaller type than the table's, so no count of characters measures it;
 * the browser lays these badges out instead, and the column (`fit`) stands exactly as wide as its widest badge in the
 * reader's language, before its rows arrive and under any filter, so no badge is cut and none leaves a gap. Each name
 * is drawn from its `data-label` by CSS, so the page's text, a search for a state and a reader find only the rows'.
 */
export function StatusRoom({ options }: { options: readonly ColumnOption[] }) {
  return (
    <div aria-hidden="true" className="invisible h-0 overflow-hidden">
      {Arr.map(options, (option) => (
        <div key={option.value}>
          <Badge variant={STATUS_BADGES.neutral}>
            <OptionIcon icon={option.icon} />
            <span
              className="before:content-[attr(data-label)]"
              data-label={option.label}
            />
          </Badge>
        </div>
      ))}
    </div>
  );
}
