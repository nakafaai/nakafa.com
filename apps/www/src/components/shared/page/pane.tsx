import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@repo/design-system/components/ui/drawer";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { TableRow } from "@repo/design-system/components/ui/table";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import { Option } from "effect";
import type { ReactNode, Ref } from "react";
import { use } from "react";
import { useTranslations } from "use-intl";
import { ListCard } from "@/components/shared/page/body";
import { usePanes } from "@/components/shared/page/panes";
import { PaneModeContext } from "@/components/shared/page/panes/mode";
import { useRowPress } from "@/components/shared/row";

/** The phone's header: centred under the swipe handle, or a row from the start with a detail's icon. */
const sheetHeaderVariants = cva("", {
  variants: {
    icon: { false: "", true: "flex-row items-center gap-3 text-start!" },
  },
});

/**
 * A detail's header: its title, and what it shows on a second line, always: every pane header holds two
 * lines (owner, 15 Nov 2026), so the type refuses a pane with a title alone, and either line takes any content, and a long one cuts off with its whole text on hover. A detail of a thing
 * with its own icon stands it before the title, as the thing's card does. Beside the list a row's
 * detail holds the button that closes it; an always-on detail has none. The phone's drawer holds no
 * close button: it closes as an iPhone sheet does, by its handle, a swipe or a press outside.
 */
export function PaneHeader({
  description,
  icon,
  title,
}: {
  /**
   * The second line: what the pane shows, as a fact, never a sentence about the controls. Any content, text or
   * designed (owner, 15 Nov 2026: a title and a description are never limited to text).
   */
  description: ReactNode;
  /** The thing's own icon, before the title. */
  icon?: ReactNode;
  /** The first line, any content; text alone also shows whole on hover when it is cut. */
  title: ReactNode;
}) {
  const titleText = typeof title === "string" ? title : undefined;
  const descriptionText =
    typeof description === "string" ? description : undefined;
  const t = useTranslations("Common");
  const { close, place } = use(PaneModeContext);

  if (place === "sheet") {
    return (
      <DrawerHeader
        className={sheetHeaderVariants({ icon: icon !== undefined })}
        data-pane-header=""
      >
        {icon}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <DrawerTitle className="truncate" dir="auto" title={titleText}>
            {title}
          </DrawerTitle>
          <DrawerDescription
            className="truncate"
            dir="auto"
            title={descriptionText}
          >
            {description}
          </DrawerDescription>
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
          <h2
            className="truncate text-sm font-medium"
            dir="auto"
            title={titleText}
          >
            {title}
          </h2>
          <p
            className="text-muted-foreground truncate text-sm"
            dir="auto"
            title={descriptionText}
          >
            {description}
          </p>
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
 * A detail's body, which scrolls down on its own under an overlay bar that takes no room. It scrolls down only, so its
 * content wraps and truncates at the pane's width instead of growing past it. It keeps the same padding in
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
 * A detail's body that one list fills: its table in the list's card (`ListCard`), at the body's padding, filling the
 * height the pane leaves and scrolling inside the card with its heads in view, or an empty state in the card's middle.
 * What the table belongs to, such as the open row's facts, stands above the card (`head`), and the list's views and its
 * search right above it (`views`), as a page's list shows them, so the pane's body is still one list.
 */
export function PaneFill({
  children,
  head,
  views,
}: {
  children: ReactNode;
  /** What stands above the table, such as the open row's facts (`PaneFacts`). */
  head?: ReactNode;
  /** The list's views and its search, which stand right above the card (`TableViews`). */
  views?: ReactNode;
}) {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-4 px-(--pane-end,1rem) py-4"
      data-slot="pane-fill"
    >
      {head === undefined ? null : <div className="shrink-0">{head}</div>}
      {views === undefined ? null : (
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {views}
        </div>
      )}
      <ListCard>{children}</ListCard>
    </div>
  );
}

/**
 * A detail's footer: one row as tall as the pane's header (`h-16`), its actions at the end, never wrapping onto
 * a second row and never holding prose, so its border meets a page's footer flush at every width. In the phone's
 * sheet it is the drawer's footer, laid out as a row, so its band runs on under the home indicator as every
 * drawer's footer does.
 */
export function PaneFooter({ children }: { children: ReactNode }) {
  const { place } = use(PaneModeContext);

  if (place === "sheet") {
    return <DrawerFooter layout="row">{children}</DrawerFooter>;
  }
  return (
    <footer className="bg-muted/70 flex h-16 shrink-0 items-center justify-end gap-2 border-t px-(--pane-end,1rem)">
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
  const press = useRowPress(() => show(id));

  return (
    <TableRow
      className="h-12"
      data-state={isOpen ? "selected" : undefined}
      {...press}
    >
      {children}
    </TableRow>
  );
}
