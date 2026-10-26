import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { useMediaQuery } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
} from "@repo/design-system/components/ui/empty";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { TableRow } from "@repo/design-system/components/ui/table";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { Option, Schema } from "effect";
import { createContext, type ReactNode, use, useState } from "react";
import { useTranslations } from "use-intl";
import { createStore, type StoreApi, useStore } from "zustand";

/** Which row of a page's list is open beside it, by its ID. */
const PanesState = Schema.Struct({ open: Schema.Option(Schema.String) });

/** The actions that open a row beside the list and close it again. */
interface PanesActions {
  readonly close: () => void;
  readonly show: (id: string) => void;
}

/** The open row of one page, with its actions. */
type PanesStore = typeof PanesState.Type & PanesActions;

/** Creates the panes of one page, with no row open. */
const createPanes = () =>
  createStore<PanesStore>()((set) => ({
    close: () => set({ open: Option.none() }),
    open: Option.none(),
    show: (id) => set({ open: Option.some(id) }),
  }));

const PanesContext = createContext<StoreApi<PanesStore> | null>(null);

/** Where an open row draws its detail: the pane beside the list, or the phone's sheet. */
const PaneMode = Schema.Literals(["aside", "sheet"]);

const PaneModeContext = createContext<typeof PaneMode.Type>("aside");

/**
 * Gives a page its two panes, created once for the page: the list in the first, and
 * the row open in the second, beside it from tablet width and in a sheet on a phone.
 */
export function PanesProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createPanes);

  return <PanesContext value={store}>{children}</PanesContext>;
}

/** Reads one selected slice of the page's panes. */
export function usePanes<T>(selector: (state: PanesStore) => T) {
  const store = use(PanesContext);

  if (store === null) {
    throw new Error("usePanes must be used within PanesProvider");
  }

  return useStore(store, selector);
}

/** Whether the page has panes, so a data table opens a row when it is pressed. */
export function useHasPanes() {
  return use(PanesContext) !== null;
}

/** The two panes as the whole body of a page: the list, then the open row beside it. */
export function Panes({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 w-full min-w-0 flex-1">{children}</div>;
}

/** The first pane: the page's list, which takes the width the open row leaves. */
export function PanesList({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-1 flex-col">{children}</div>;
}

/**
 * The second pane: the open row's detail beside the list from tablet width, where it
 * says what it will show while no row is open, and a sheet from the bottom on a phone,
 * which closes the row as it closes. The detail draws in one place at a time.
 */
export function PanesDetail({
  children,
  empty,
  label,
}: {
  /** The open row's header, body and footer. */
  children: ReactNode;
  /** What the pane shows while no row is open, in one sentence. */
  empty: string;
  /** The pane's name for a screen reader. */
  label: string;
}) {
  const wide = useMediaQuery(TAILWIND_MEDIA_QUERIES.mdAndUp);
  const isOpen = usePanes((state) => Option.isSome(state.open));
  const close = usePanes((state) => state.close);

  return (
    <>
      <aside
        aria-label={label}
        className="sticky top-16 hidden h-[calc(100svh-4rem)] w-80 shrink-0 flex-col self-start border-l bg-background md:flex lg:w-96"
      >
        {wide && isOpen ? (
          <PaneModeContext value="aside">{children}</PaneModeContext>
        ) : (
          <Empty className="flex-1">
            <EmptyHeader>
              <EmptyDescription>{empty}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </aside>
      <Sheet
        onOpenChange={(next) => {
          if (!next) {
            close();
          }
        }}
        open={!wide && isOpen}
      >
        <SheetContent className="max-h-[85svh]" side="bottom">
          {!wide && isOpen ? (
            <PaneModeContext value="sheet">{children}</PaneModeContext>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

/**
 * The open row's header: its title, and what it is on a second line. Beside the list it
 * holds the button that closes the row; the phone's sheet has its own.
 */
export function PaneHeader({
  description,
  title,
}: {
  description?: string;
  title: string;
}) {
  const t = useTranslations("Common");
  const mode = use(PaneModeContext);
  const close = usePanes((state) => state.close);

  if (mode === "sheet") {
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
        <h2 className="truncate font-medium text-sm" dir="auto">
          {title}
        </h2>
        {description === undefined ? null : (
          <p className="truncate text-muted-foreground text-sm" dir="auto">
            {description}
          </p>
        )}
      </div>
      <Button
        aria-label={t("close")}
        onClick={close}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <HugeIcons icon={Cancel01Icon} />
      </Button>
    </header>
  );
}

/** The open row's body, which scrolls on its own. */
export function PaneBody({ children }: { children: ReactNode }) {
  const mode = use(PaneModeContext);

  return (
    <div
      className={
        mode === "sheet"
          ? "min-h-0 flex-1 overflow-y-auto px-4 pb-4"
          : "min-h-0 flex-1 overflow-y-auto p-4"
      }
    >
      {children}
    </div>
  );
}

/** The open row's footer: one row of its actions, at the end. */
export function PaneFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="flex shrink-0 items-center justify-end gap-2 border-t px-4 py-3">
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
