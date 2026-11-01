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
import { cva } from "class-variance-authority";
import { cn } from "cn";
import { Option } from "effect";
import type { MouseEvent, ReactNode } from "react";
import { useTranslations } from "use-intl";
import { usePaneMode, usePanes } from "@/components/shared/panes";
import { tableCardVariants } from "@/components/shared/table/card";

/** The phone's header: centred under the swipe handle, or a row from the start with a detail's icon. */
const sheetHeaderVariants = cva("relative", {
  variants: {
    icon: { false: "px-10", true: "flex-row items-center gap-3 text-start!" },
  },
});

/** The phone's close button: in the corner of a centred header, or at the end of a header's row. */
const sheetCloseVariants = cva("", {
  variants: { icon: { false: "absolute end-2 top-2", true: "shrink-0" } },
});

/**
 * A detail's header: its title, and what it shows on a second line, so it holds two lines at most
 * as every header does, and a long one cuts off with its whole text on hover. A detail of a thing
 * with its own icon stands it before the title, as the thing's card does. Beside the list a row's
 * detail holds the button that closes it; an always-on detail has none. The phone's drawer holds
 * the same button, for a reader who does not swipe.
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
        <Button
          aria-label={t("close")}
          className={sheetCloseVariants({ icon: icon !== undefined })}
          onClick={close}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <HugeIcons icon={Cancel01Icon} />
        </Button>
      </DrawerHeader>
    );
  }

  return (
    <header
      className="flex min-h-14 shrink-0 items-center gap-2 border-b py-2 px-(--pane-end,1rem)"
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
          aria-label={t("close")}
          onClick={close}
          size="icon-sm"
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
export function PaneBody({ children }: { children: ReactNode }) {
  return (
    <ScrollArea className="flex-1">
      <div className="py-4 px-(--pane-end,1rem)">{children}</div>
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

/** A detail's footer: its actions at the end, on a second row where a narrow pane cannot hold them in one. */
export function PaneFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="bg-muted/70 flex shrink-0 flex-wrap items-center justify-end gap-2 border-t py-3 px-(--pane-end,1rem)">
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

/** The facts of the open row, one under another. */
export function PaneFacts({ children }: { children: ReactNode }) {
  return <dl className="flex flex-col gap-4">{children}</dl>;
}

/** The row's main cell: its name, as a button that opens the row beside the list. */
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
      className="font-medium underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
      dir="auto"
      onClick={() => show(id)}
      type="button"
    >
      {children}
    </button>
  );
}

/** The elements of a row that do their own thing when pressed, so pressing them opens no row. */
const ROW_CONTROLS =
  "a, button, input, label, select, textarea, [role=menuitem]";

/**
 * Whether a press landed on the row itself: not on a control of its own, and not on a menu or a dialog the row opened,
 * whose press React carries through the row although it stands elsewhere on the page.
 */
export const pressesRow = (event: MouseEvent<HTMLTableRowElement>) =>
  event.target instanceof Element &&
  event.currentTarget.contains(event.target) &&
  event.target.closest(ROW_CONTROLS) === null;

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
