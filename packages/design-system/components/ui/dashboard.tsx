import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { Nina } from "@repo/design-system/components/ui/nina";
import type { ActSchema } from "@repo/mascot/nina/act";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps, ReactElement, ReactNode } from "react";

/**
 * The connected surface of a dashboard: its cells share one rounded border and one-pixel dividers. Its columns
 * follow the width of the container, not the viewport: one column below 600 pixels, two from 600, and three from
 * 960, or four from 960 for a strip of numbers.
 */
const dashboardVariants = cva(
  "grid gap-px overflow-hidden rounded-xl bg-foreground/10 shadow-xs ring-1 ring-foreground/10",
  {
    defaultVariants: { columns: "three" },
    variants: {
      columns: {
        four: "@min-[960px]:grid-cols-4 grid-cols-2",
        three: "@min-[600px]:grid-cols-2 @min-[960px]:grid-cols-3 grid-cols-1",
      },
    },
  }
);

/**
 * A cell's span. `two` is how many of two columns it takes from 600 pixels, and `three` how many of three from 960
 * pixels. Below 600 pixels every cell takes the one column, so a span shows only from its breakpoint.
 */
const cellVariants = cva(
  "flex min-w-0 flex-col gap-4 bg-card py-6 text-card-foreground",
  {
    defaultVariants: { three: 1, two: 1 },
    variants: {
      three: {
        1: "@min-[960px]:col-span-1",
        2: "@min-[960px]:col-span-2",
        3: "@min-[960px]:col-span-3",
      },
      two: {
        1: "",
        2: "@min-[600px]:col-span-2",
      },
    },
  }
);

/** A row of a list. A row that opens a page lights up on hover, the way a link row does. */
const rowVariants = cva("flex min-w-0 items-center gap-3 px-6 py-3", {
  defaultVariants: { linked: false },
  variants: {
    linked: {
      false: "",
      true: "transition-colors ease-out hover:bg-accent hover:text-accent-foreground",
    },
  },
});

/**
 * The connected surface of a dashboard. Its cells hold numbers, charts and lists, each with a title, and a cell
 * with nothing to show is left out, so the grid closes its gap. The parts compose directly: a `Dashboard.Cell`
 * holds a `Dashboard.CellHeader`, then its `Dashboard.Value`, `Dashboard.Period`, `Dashboard.List` or
 * `Dashboard.Empty`. A cell that opens a page passes its link through `render`.
 */
function DashboardRoot({
  children,
  className,
  columns,
}: ComponentProps<"div"> & VariantProps<typeof dashboardVariants>) {
  return (
    <div className="@container">
      <div
        className={cn(dashboardVariants({ columns }), className)}
        data-slot="dashboard"
      >
        {children}
      </div>
    </div>
  );
}

/** One cell of a dashboard. It takes its spans from `two` and `three`, and `render` makes the whole cell a link. */
function DashboardCell({
  className,
  render,
  three,
  two,
  ...props
}: ComponentProps<"div"> &
  VariantProps<typeof cellVariants> & {
    /** The element that the cell renders as, such as a link that holds the whole cell. */
    render?: ReactElement;
  }) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { className: cn(cellVariants({ three, two }), className) },
      props
    ),
    render,
    state: { slot: "dashboard-cell" },
  });
}

/** The title of a cell at its top left, and one meta or link at its right. */
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
      <h3 className="min-w-0 truncate font-medium text-base">{title}</h3>
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
  return <p className="px-6 text-muted-foreground text-sm">{children}</p>;
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

/** The rows of a cell, divided by hairlines and set off from the cell's header. */
function DashboardList({ children }: { children: ReactNode }) {
  return <ul className="divide-y border-t">{children}</ul>;
}

/**
 * One row of a list: an optional icon or avatar, two lines that truncate, an optional trailing value such as a
 * relative time, and an optional action. `render` makes the row's text a link to the page it shows. `footer` sits
 * under the two lines, for a bar of progress. The action stays outside the link, so a row may hold a button.
 */
function DashboardRow({
  action,
  detail,
  footer,
  icon,
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
  /** The icon or avatar at the row's start. */
  icon?: ReactNode;
  /** The element that the row's text renders as, such as a link to the page it opens. */
  render?: ReactElement | undefined;
  title: string;
  /** A value at the row's end, such as a relative time, which shares the link. */
  trailing?: ReactNode;
}) {
  return (
    <li className={rowVariants({ linked: render !== undefined })}>
      <DashboardRowText
        detail={detail}
        footer={footer}
        icon={icon}
        render={render}
        title={title}
        trailing={trailing}
      />
      {action}
    </li>
  );
}

/** The text of a row, which is a link when the row opens a page and a plain block when it does not. */
function DashboardRowText({
  detail,
  footer,
  icon,
  render,
  title,
  trailing,
}: {
  detail: string | undefined;
  footer: ReactNode;
  icon: ReactNode;
  render: ReactElement | undefined;
  title: string;
  trailing: ReactNode;
}) {
  return useRender({
    defaultTagName: "div",
    props: {
      children: (
        <>
          {icon}
          <span className="grid min-w-0 flex-1 gap-1">
            <span className="truncate font-medium">{title}</span>
            {detail === undefined ? null : (
              <span className="truncate text-muted-foreground text-xs">
                {detail}
              </span>
            )}
            {footer}
          </span>
          {trailing}
        </>
      ),
      className:
        "flex min-w-0 flex-1 items-center gap-3 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    },
    render,
  });
}

/** The state of a cell that has nothing to show yet: Nina doing what fits, and one sentence that says why. */
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
    <div className="flex flex-col items-center gap-3 px-6 text-center">
      <Nina act={act} label="" size={64} whole />
      <p className="max-w-sm text-balance text-muted-foreground text-sm">
        {children}
      </p>
    </div>
  );
}

/**
 * The compound parts of a dashboard: `Dashboard` is the connected surface, and its parts are the cell, the cell's
 * header, figure, period, meter, list, row and empty state.
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
