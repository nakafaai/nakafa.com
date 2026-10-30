import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { TableRow } from "@repo/design-system/components/ui/table";
import { Option } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { usePaneMode, usePanes } from "@/components/shared/panes";

/**
 * A detail's header: its title, and what it shows on a second line; both wrap rather than
 * cut off. Beside the list a row's detail holds the button that closes it; an always-on
 * detail has none, and the phone's sheet has its own.
 */
export function PaneHeader({
  description,
  title,
}: {
  description?: string | undefined;
  title: string;
}) {
  const t = useTranslations("Common");
  const { close, place } = usePaneMode();

  if (place === "sheet") {
    return (
      <SheetHeader>
        <SheetTitle dir="auto">{title}</SheetTitle>
        {description === undefined ? null : (
          <SheetDescription dir="auto">{description}</SheetDescription>
        )}
      </SheetHeader>
    );
  }

  return (
    <header className="flex min-h-14 shrink-0 items-center gap-2 border-b px-4 py-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2 className="wrap-anywhere font-medium text-sm" dir="auto">
          {title}
        </h2>
        {description === undefined ? null : (
          <p className="wrap-anywhere text-muted-foreground text-sm" dir="auto">
            {description}
          </p>
        )}
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
 * A detail's body, which scrolls on its own. It keeps the same padding in the pane and in the phone's sheet: both
 * headers end on a rule, so the body's first field needs the room above it, and its focus ring stays inside the
 * scrolling box.
 */
export function PaneBody({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>;
}

/** A detail's footer: its actions at the end, on a second row where a narrow pane cannot hold them in one. */
export function PaneFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t px-4 py-3">
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
      <dd className="font-medium text-sm" dir="auto">
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
      className="h-12 cursor-pointer"
      data-state={isOpen ? "selected" : undefined}
      onClick={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest(ROW_CONTROLS) !== null
        ) {
          return;
        }
        show(id);
      }}
    >
      {children}
    </TableRow>
  );
}
