import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@repo/design-system/components/ui/drawer";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { TableRow } from "@repo/design-system/components/ui/table";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Option } from "effect";
import type { ReactNode, Ref } from "react";
import { useTranslations } from "use-intl";
import { usePanes } from "@/components/shared/panes";
import { usePaneMode } from "@/components/shared/panes/mode";
import { pressesRow } from "@/components/shared/row";
import { tableCardVariants } from "@/components/shared/table/card";

/** The phone's header: centred under the swipe handle, or a row from the start with a detail's icon. */
const sheetHeaderVariants = cva("", {
  variants: {
    icon: { false: "", true: "flex-row items-center gap-3 text-start!" },
  },
});

/**
 * A detail's header: its title, and what it shows on a second line, so it holds two lines at most
 * as every header does, and a long one cuts off with its whole text on hover. A detail of a thing
 * with its own icon stands it before the title, as the thing's card does. Beside the list a row's
 * detail holds the button that closes it; an always-on detail has none. The phone's drawer holds no
 * close button: it closes as an iPhone sheet does, by its handle, a swipe or a press outside.
 */
export function PaneHeader({
  description,
  icon,
  title,
}: {
  description?: string | undefined;
  /** The thing's own icon, before the title. */
  icon?: ReactNode;
  title: string;
}) {
  const t = useTranslations("Common");
  const { close, place } = usePaneMode();

  if (place === "sheet") {
    return (
      <DrawerHeader
        className={sheetHeaderVariants({ icon: icon !== undefined })}
        data-pane-header=""
      >
        {icon}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <DrawerTitle className="truncate" dir="auto" title={title}>
            {title}
          </DrawerTitle>
          {description === undefined ? null : (
            <DrawerDescription
              className="truncate"
              dir="auto"
              title={description}
            >
              {description}
            </DrawerDescription>
          )}
        </div>
      </DrawerHeader>
    );
  }

  return (
    <header
      className="relative flex h-16 shrink-0 items-center border-b px-(--pane-end,1rem) has-[button]:pe-10"
      data-pane-header=""
      data-slot="pane-header"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {icon}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="truncate text-sm font-medium" dir="auto" title={title}>
            {title}
          </h2>
          {description === undefined ? null : (
            <p
              className="text-muted-foreground truncate text-sm"
              dir="auto"
              title={description}
            >
              {description}
            </p>
          )}
        </div>
      </div>
      {close === undefined ? null : (
        <Button
          className="absolute end-2 top-2"
          onClick={close}
          size="icon-sm"
          tooltip={t("close")}
          type="button"
          variant="ghost"
        >
          <HugeIcons icon={Cancel01Icon} />
        </Button>
      )}
    </header>
  );
}

/**
 * A detail's body, which scrolls on its own under an overlay bar that takes no room. It keeps the same padding in
 * the pane and in the phone's sheet: both headers end on a rule, so the body's first field needs the room above it,
 * and its focus ring stays inside the scrolling box.
 */
export function PaneBody({
  children,
  viewportRef,
}: {
  children: ReactNode;
  /** The scrolling element, for a body that keeps something of its own in view, as the player's navigator does. */
  viewportRef?: Ref<HTMLDivElement>;
}) {
  return (
    <ScrollArea
      className="flex-1"
      viewportClassName="relative"
      viewportRef={viewportRef}
    >
      <div className="px-(--pane-end,1rem) py-4">{children}</div>
    </ScrollArea>
  );
}

/**
 * A detail's body that one thing fills from edge to edge, with no padding of its own: a table, which scrolls inside it
 * with its heads in view and closes on its last row (`tableCardVariants`), or an empty state in its middle.
 */
export function PaneFill({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        tableCardVariants(),
        "bg-card flex min-h-0 flex-1 flex-col overflow-y-auto"
      )}
      data-slot="pane-fill"
    >
      {children}
    </div>
  );
}

/**
 * A detail's footer: its actions at the end, on a second row where a narrow pane cannot hold them in one. It keeps the
 * height of a row with a button, so a state that asks for nothing moves nothing above it.
 */
export function PaneFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="bg-muted/70 flex min-h-16 shrink-0 flex-wrap items-center justify-end gap-2 border-t px-(--pane-end,1rem) py-3">
      {children}
    </footer>
  );
}

/** A fact of the open row: its label, and its value under it. */
export function PaneFact({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-sm font-medium" dir="auto">
        {children}
      </dd>
    </div>
  );
}

/**
 * The facts of a detail: one under another, or, for short values such as a result's numbers, two to a row once
 * the pane is wide enough that every label keeps one line, and one under another below that.
 */
const paneFactsVariants = cva("gap-4", {
  defaultVariants: { layout: "stack" },
  variants: {
    layout: {
      grid: "grid tabular-nums @xs:grid-cols-2",
      stack: "flex flex-col",
    },
  },
});

/** The facts of the open row, one under another, or two to a row when `layout` is `grid`. */
export function PaneFacts({
  children,
  layout,
}: VariantProps<typeof paneFactsVariants> & { children: ReactNode }) {
  return (
    <div className="@container">
      <dl className={paneFactsVariants({ layout })}>{children}</dl>
    </div>
  );
}

/**
 * The row's main cell: its name, as a button that opens the row beside the list. It fills the width its column holds and
 * keeps the name on one line, ending in an ellipsis past it, which the first column shows whole on hover (`TableLead`).
 */
export function PaneOpen({
  children,
  id,
}: {
  children: ReactNode;
  id: string;
}) {
  const show = usePanes((state) => state.show);

  return (
    <button
      className="block w-full truncate text-start font-medium underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
      dir="auto"
      onClick={() => show(id)}
      type="button"
    >
      {children}
    </button>
  );
}

/**
 * A data table's row on a page with panes: pressing it opens the row beside the list,
 * unless the press lands on a control of its own, and the open row stays marked.
 */
export function PaneTableRow({
  children,
  id,
}: {
  children: ReactNode;
  id: string;
}) {
  const isOpen = usePanes((state) =>
    Option.exists(state.open, (open) => open === id)
  );
  const show = usePanes((state) => state.show);

  return (
    <TableRow
      className="h-12"
      data-state={isOpen ? "selected" : undefined}
      onClick={(event) => {
        if (pressesRow(event)) {
          show(id);
        }
      }}
    >
      {children}
    </TableRow>
  );
}
