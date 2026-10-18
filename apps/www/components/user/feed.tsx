import { NumberFormat } from "@repo/design-system/components/ui/number-flow";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { cva } from "class-variance-authority";
import { DateTime } from "effect";
import type { ComponentProps, ReactNode } from "react";

/** The frame every row of a profile shares, the composer's included. */
const rowVariants = cva("relative flex items-start gap-3 border-b py-4");

/**
 * The rows of a profile, one anatomy under every tab, as in Threads: the
 * owner's picture in a leading column, then a body of a header line, the
 * content and the actions. Every row ends with a hairline. The leading actions
 * and the trailing menu sit on the content's edges, so every icon lines up with
 * the text above it.
 */
export function FeedRow({ children }: { children: ReactNode }) {
  return (
    <article className={rowVariants()} data-slot="feed-row">
      {children}
    </article>
  );
}

/** The composer's row: a form in the frame of the rows below it. */
export function FeedForm(props: Omit<ComponentProps<"form">, "className">) {
  return <form className={rowVariants()} {...props} />;
}

/** The picture of a row, at the one size every row and the composer use. */
export function FeedAvatar(
  props: Omit<ComponentProps<typeof PersonAvatar>, "className">
) {
  return <PersonAvatar className="size-10 shrink-0" {...props} />;
}

/** The column beside the picture: the header line, the content and the actions. */
export function FeedBody({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-1 flex-col gap-1">{children}</div>;
}

/**
 * The first line of a row: a name or a title that gives way first, its age
 * that never wraps, and a trailing menu.
 */
export function FeedHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-5 min-w-0 items-center gap-2 text-sm">
      {children}
    </div>
  );
}

/** The name or the title of a row, cut at the end when the line is too narrow. */
export function FeedName({ children }: { children: ReactNode }) {
  return <span className="truncate font-medium">{children}</span>;
}

/** How long ago the row was written, with its moment for a screen reader and a crawler. */
export function FeedAge({ at, children }: { at: number; children: string }) {
  return (
    <time
      className="shrink-0 text-muted-foreground"
      dateTime={DateTime.formatIso(DateTime.makeUnsafe(at))}
    >
      {children}
    </time>
  );
}

/**
 * The trailing menu of a row. It takes no more height than the line and moves
 * out by the button's own padding, so its icon ends on the content's edge. It
 * sits above a row that is one link, so the menu stays its own control.
 */
export function FeedEnd({ children }: { children: ReactNode }) {
  return (
    <div className="relative z-1 -my-1.5 ms-auto -me-2 flex shrink-0 items-center">
      {children}
    </div>
  );
}

/**
 * The actions of a row, side by side at their own widths. The row moves in by
 * the first button's padding, so the first icon starts on the content's edge,
 * and down by the buttons' lower padding, so the icons end as far above the
 * row's border as the avatar starts below the row above.
 */
export function FeedActions({
  children,
  inert,
}: {
  children: ReactNode;
  inert?: boolean;
}) {
  return (
    <div className="-ms-2.5 -mb-2 flex items-center" inert={inert}>
      {children}
    </div>
  );
}

/**
 * The count beside an action of a row, in the compact form, shown once it is above
 * zero. An action takes its own width, so a zero leaves no empty slot.
 */
export function FeedCount({ value }: { value: number }) {
  if (value === 0) {
    return null;
  }
  return (
    <NumberFormat
      className="text-xs tabular-nums"
      format={{ notation: "compact", maximumFractionDigits: 1 }}
      isolate={true}
      value={value}
    />
  );
}

/** A notice inside the list, such as a failed read, at the rows' own padding. */
export function FeedNotice({ children }: { children: ReactNode }) {
  return <div className="py-4">{children}</div>;
}

/** What a tab says when it has no rows. */
export function FeedEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="py-12 text-center text-muted-foreground text-sm">
      {children}
    </p>
  );
}
