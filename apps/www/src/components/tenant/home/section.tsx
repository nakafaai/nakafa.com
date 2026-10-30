import { Card } from "@repo/design-system/components/ui/card";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@repo/design-system/components/ui/item";
import { cva } from "class-variance-authority";
import { type ComponentProps, type ReactNode, useId } from "react";

/**
 * The two columns of the school home from a desktop width: the viewer's work in the wider one, and the updates beside
 * it. A home with nothing for the wider column gives the whole width to the other. On a phone and a
 * tablet the columns stack in that order.
 */
const columnVariants = cva("flex min-w-0 flex-col gap-8", {
  variants: {
    span: {
      main: "lg:col-span-2",
      side: "",
      whole: "lg:col-span-3",
    },
  },
});

/** The grid of the school home's columns. */
export function HomeGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-8 lg:grid-cols-3">{children}</div>;
}

/** One column of the school home's grid, which takes its share of the width from `span`. */
export function HomeColumn({
  children,
  span,
}: {
  children: ReactNode;
  span: "main" | "side" | "whole";
}) {
  return <div className={columnVariants({ span })}>{children}</div>;
}

/**
 * One section of the school home: its name as a small heading outside its card, with an optional link at the end of
 * the heading's row, and then what it holds. A section's card holds rows only, set apart by space and by their hover
 * and never by rules, so the home reads as a few calm blocks at every width.
 */
export function HomeSection({
  action,
  children,
  title,
}: {
  /** A link at the end of the heading's row, such as the way to every update. */
  action?: ReactNode;
  children: ReactNode;
  title: string;
}) {
  const id = useId();

  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2
          className="text-balance font-medium text-muted-foreground text-sm"
          id={id}
        >
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** The card of a section, which holds the section's rows as one list. */
export function HomeCard({ children }: { children: ReactNode }) {
  return (
    <Card className="p-1.5" size="sm">
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </Card>
  );
}

/** One row of a section's card: a list item whose whole width is the row's link, or its plain block. */
export function HomeRow(props: Omit<ComponentProps<typeof Item>, "size">) {
  return (
    <li className="min-w-0">
      <Item size="sm" {...props} />
    </li>
  );
}

/**
 * The text of a row with a time or score at its end grows from twelve rems, so the end moves under the text once the
 * row is too narrow for both. Without an end, the text takes whatever the row leaves.
 */
const rowTextVariants = cva("min-w-0 gap-0.5", {
  variants: {
    timed: {
      false: "",
      true: "basis-48",
    },
  },
});

/**
 * The text of a row: its title over its detail, and its time or score at the end, which moves under them when the row
 * is too narrow for both. Every part wraps rather than clips, and the title and the detail take their own direction,
 * so a title in Arabic reads right to left.
 */
export function HomeRowText({
  detail,
  title,
  when,
}: {
  detail?: string | undefined;
  title: string;
  when?: string | undefined;
}) {
  return (
    <>
      <ItemContent className={rowTextVariants({ timed: when !== undefined })}>
        <ItemTitle className="wrap-anywhere line-clamp-none" dir="auto">
          {title}
        </ItemTitle>
        {detail === undefined ? null : (
          <ItemDescription className="wrap-anywhere line-clamp-none" dir="auto">
            {detail}
          </ItemDescription>
        )}
      </ItemContent>
      {when === undefined ? null : (
        <span className="text-muted-foreground text-sm tabular-nums">
          {when}
        </span>
      )}
    </>
  );
}

/** The one sentence of a section that has nothing to list yet, inside its card. */
export function HomeQuiet({ children }: { children: ReactNode }) {
  return (
    <Card className="px-4 py-3.5" size="sm">
      <p className="text-muted-foreground text-sm">{children}</p>
    </Card>
  );
}
