import { CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import { Nina } from "@repo/design-system/components/ui/nina";
import type { ActSchema } from "@repo/mascot/nina/act";
import type { ReactNode } from "react";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";

/**
 * One tile of the school home: a card with its title, its body, and a footer with one concise
 * sentence and at most one action. Every tile ends the same way, so the footer is never left out.
 * Its body is at least one row high, so a tile keeps its height while its rows arrive.
 */
export function HomeTile({
  action,
  children,
  className,
  hint,
  title,
}: {
  /** The tile's one action, at the end of its footer. */
  action?: ReactNode;
  /** The tile's rows or its empty state. A tile whose rows have not arrived has none. */
  children?: ReactNode;
  className?: string | undefined;
  /** The one concise sentence of the footer, which says what the action does or what stops it. */
  hint: string;
  title: string;
}) {
  return (
    <CardSection className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <div className="min-h-19">{children}</div>
      <CardSectionFooter hint={hint}>
        {action === undefined ? null : (
          <CardSectionActions>{action}</CardSectionActions>
        )}
      </CardSectionFooter>
    </CardSection>
  );
}

/**
 * The body of a tile with nothing to show: Nina doing what fits the list, and one sentence, in the
 * height of one row, so the tile is as tall as it is when it holds a row.
 */
export function TileEmpty({
  act,
  children,
}: {
  act: typeof ActSchema.Type;
  children: string;
}) {
  return (
    <div className="flex items-center gap-3 px-6 py-3">
      <Nina act={act} label="" size={48} whole />
      <p className="text-muted-foreground text-sm">{children}</p>
    </div>
  );
}

/** A row's two lines: its title, and a second line of detail, each on one line that truncates. */
export function RowText({
  detail,
  title,
}: {
  detail: ReactNode;
  title: string;
}) {
  return (
    <span className="grid min-w-0 flex-1 gap-0.5">
      <span className="truncate font-medium">{title}</span>
      <span className="truncate text-muted-foreground text-xs">{detail}</span>
    </span>
  );
}
