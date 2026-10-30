import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import {
  EmptyDescription,
  EmptyMedia,
} from "@repo/design-system/components/ui/empty";
import { Nina } from "@repo/design-system/components/ui/nina";
import type { ActSchema } from "@repo/mascot/nina/act";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps, ReactElement, ReactNode } from "react";

/**
 * The grid of a dashboard: each cell is a card of its own, with the gap of the page between cards. Its columns follow
 * the width of the container, not the viewport: two columns below 960 pixels and twelve from 960, so a cell's wide
 * span is its share of twelfths.
 */
const dashboardVariants = cva(
  "grid @min-[960px]:grid-cols-12 grid-cols-2 gap-4"
);

/** The number of columns that a cell's wide span counts in, from 960 pixels. */
export type WideColumns = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/**
 * A cell's span. `narrow` is how many of the two columns it takes from 600 pixels, and `wide` how many twelfths of the
 * row it takes from 960 pixels. Below 600 pixels a cell takes the whole row, unless it is one of a `pair` of small
 * cells, such as two numbers, which share a row on a phone too.
 */
const cellVariants = cva(
  "col-span-2 flex min-w-0 flex-col gap-4 overflow-hidden rounded-xl bg-card py-6 text-card-foreground shadow-xs ring-1 ring-foreground/10 has-[>[data-slot=dashboard-list]:last-child]:pb-3",
  {
    defaultVariants: { linked: false, narrow: 1, pair: false, wide: 12 },
    variants: {
      linked: {
        false: "",
        true: "group outline-none transition-colors ease-out hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
      },
      narrow: {
        1: "@min-[600px]:col-span-1",
        2: "",
      },
      pair: {
        false: "",
        true: "col-span-1",
      },
      wide: {
        1: "@min-[960px]:col-span-1",
        2: "@min-[960px]:col-span-2",
        3: "@min-[960px]:col-span-3",
        4: "@min-[960px]:col-span-4",
        5: "@min-[960px]:col-span-5",
        6: "@min-[960px]:col-span-6",
        7: "@min-[960px]:col-span-7",
        8: "@min-[960px]:col-span-8",
        9: "@min-[960px]:col-span-9",
        10: "@min-[960px]:col-span-10",
        11: "@min-[960px]:col-span-11",
        12: "@min-[960px]:col-span-12",
      },
    },
  }
);

/** A row of a list. A row that opens a page lights up on hover, the way a link row does. */
const rowVariants = cva("group flex min-w-0 flex-col gap-2 px-6 py-3", {
  defaultVariants: { linked: false },
  variants: {
    linked: {
      false: "",
      true: "transition-colors ease-out hover:bg-accent hover:text-accent-foreground",
    },
  },
});

/**
 * The grid of a dashboard. Each cell is a card of one concern: numbers, a chart or a list, each with a title, and a
 * cell with nothing to show is left out, so the grid closes its gap. The parts compose directly: a `Dashboard.Cell` holds a
 * `Dashboard.CellHeader`, then its `Dashboard.Value`, `Dashboard.Period`, `Dashboard.List` or `Dashboard.Empty`. A
 * cell that opens a page passes its link through `render`, which lights the whole cell up on hover and focus.
 */
function DashboardRoot({ children, className }: ComponentProps<"div">) {
  return (
    <div className="@container">
      <div className={cn(dashboardVariants(), className)} data-slot="dashboard">
        {children}
      </div>
    </div>
  );
}

/**
 * One card of a dashboard. It takes its spans from `narrow` and `wide`, `pair` shares a phone's row with the next small
 * card, and `render` makes the whole cell a link.
 */
function DashboardCell({
  className,
  narrow,
  pair,
  render,
  wide,
  ...props
}: ComponentProps<"div"> &
  Omit<VariantProps<typeof cellVariants>, "linked"> & {
    /** The span of the cell from 960 pixels, in twelfths of the row. */
    wide?: WideColumns;
    /** The element that the cell renders as, such as a link that holds the whole cell. */
    render?: ReactElement;
  }) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          cellVariants({ linked: render !== undefined, narrow, pair, wide }),
          className
        ),
      },
      props
    ),
    render,
    state: { slot: "dashboard-cell" },
  });
}

/**
 * The title of a card at its top left, and one meta or link at its right. The title names what the card holds, in
 * plain words with no icon, as every card of the grid does. A long title wraps rather than cuts off.
 */
function DashboardCellHeader({
  children,
  title,
}: {
  /** One meta or link at the right of the title. */
  children?: ReactNode;
  title: string;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 px-6">
      <h3 className="min-w-0 text-balance font-medium text-base">{title}</h3>
      {children}
    </div>
  );
}

/** A large number, which reads as one figure and keeps its digits aligned as it changes. */
function DashboardValue({ children }: { children: ReactNode }) {
  return (
    <p className="px-6 font-semibold text-3xl tabular-nums leading-none">
      {children}
    </p>
  );
}

/** The muted line under a figure, which says what the figure counts. */
function DashboardPeriod({ children }: { children: ReactNode }) {
  return (
    <p className="px-6 text-muted-foreground text-sm group-hover:text-accent-foreground">
      {children}
    </p>
  );
}

/** A thin bar that shows how far along a span of time is, from none to the whole. */
function DashboardMeter({
  label,
  percent,
}: {
  /** What the bar measures, for assistive technology. */
  label: string;
  /** How far along, from 0 to 100. */
  percent: number;
}) {
  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={percent}
      className="h-1 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
    >
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/**
 * The rows of a cell, divided by hairlines and set off from the cell's header. A cell that ends with its list keeps as
 * much room under the last row as above its title.
 */
function DashboardList({ children }: { children: ReactNode }) {
  return (
    <ul className="divide-y border-t" data-slot="dashboard-list">
      {children}
    </ul>
  );
}

/**
 * One row of a list: two lines that truncate, an optional trailing value such as a relative time, and an optional
 * action. `render` makes the row's text a link to the page it shows. `footer` sits under the two lines, for a bar of
 * progress. The action stays outside the link, so a row may hold a button. The trailing value and the detail take the
 * muted colour, and the accent colour on hover, so they read on a lit row.
 */
function DashboardRow({
  action,
  detail,
  footer,
  render,
  title,
  trailing,
}: {
  /** An action of the row, such as a button, which sits outside the link. */
  action?: ReactNode;
  /** The second line, which says where or when, in one line that truncates. */
  detail?: string | undefined;
  /** Anything under the two lines, such as a bar of progress. */
  footer?: ReactNode;
  /** The element that the row's text renders as, such as a link to the page it opens. */
  render?: ReactElement | undefined;
  title: string;
  /** A value at the row's end, such as a relative time, which shares the link. */
  trailing?: ReactNode;
}) {
  return (
    <li className={rowVariants({ linked: render !== undefined })}>
      <div className="flex min-w-0 items-center gap-3">
        <DashboardRowText
          detail={detail}
          render={render}
          title={title}
          trailing={trailing}
        />
        {action}
      </div>
      {footer === undefined || footer === null ? null : (
        <div className="min-w-0">{footer}</div>
      )}
    </li>
  );
}

/** The text of a row, which is a link when the row opens a page and a plain block when it does not. */
function DashboardRowText({
  detail,
  render,
  title,
  trailing,
}: {
  detail: string | undefined;
  render: ReactElement | undefined;
  title: string;
  trailing: ReactNode;
}) {
  return useRender({
    defaultTagName: "div",
    props: {
      children: (
        <>
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="truncate font-medium">{title}</span>
            {detail === undefined ? null : (
              <span className="truncate text-muted-foreground text-xs group-hover:text-accent-foreground">
                {detail}
              </span>
            )}
          </span>
          {trailing === undefined || trailing === null ? null : (
            <span className="shrink-0 text-muted-foreground text-sm tabular-nums group-hover:text-accent-foreground">
              {trailing}
            </span>
          )}
        </>
      ),
      className:
        "flex min-w-0 flex-1 items-center gap-3 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    },
    render,
  });
}

/**
 * The state of a cell that has nothing to show yet: Nina doing what fits, and one sentence that says why. Nina stands
 * at 64 pixels, because a cell is a share of the page and not the page itself.
 */
function DashboardEmpty({
  act,
  children,
}: {
  /** What Nina does, which fits the place. */
  act: typeof ActSchema.Type;
  /** One sentence with a period, which says what the cell is waiting for. */
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 px-6 text-start">
      <EmptyMedia className="mb-0">
        <Nina act={act} label="" size={64} whole />
      </EmptyMedia>
      <EmptyDescription className="max-w-sm">{children}</EmptyDescription>
    </div>
  );
}

/**
 * The compound parts of a dashboard: `Dashboard` is the grid of cards, and its parts are the card, its header,
 * figure, period, meter, list, row and empty state.
 */
export const Dashboard = Object.assign(DashboardRoot, {
  Cell: DashboardCell,
  CellHeader: DashboardCellHeader,
  Empty: DashboardEmpty,
  List: DashboardList,
  Meter: DashboardMeter,
  Period: DashboardPeriod,
  Row: DashboardRow,
  Value: DashboardValue,
});
