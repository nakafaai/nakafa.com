import { useMediaQuery } from "@mantine/hooks";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
} from "@repo/design-system/components/ui/empty";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@repo/design-system/components/ui/resizable";
import { Sheet, SheetContent } from "@repo/design-system/components/ui/sheet";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { cva } from "class-variance-authority";
import { Option, Schema } from "effect";
import { createContext, type ReactNode, use, useState } from "react";
import { createPortal } from "react-dom";
import { createStore, type StoreApi, useStore } from "zustand";

/** From which width the open row stands beside the list: tablet for a list, laptop for the exam editor. */
const PanesWidth = Schema.Literals(["md", "lg"]);

/** Which row of a page's list is open beside it, by its ID, and whether the phone's sheet shows it. */
const PanesState = Schema.Struct({
  open: Schema.Option(Schema.String),
  sheet: Schema.Boolean,
});

/**
 * The actions of a page's panes, and the elements that a detail drawn elsewhere on the page
 * portals into: the body of the pane beside the list and the body of the phone's sheet. No
 * Schema describes an element, so this part is a plain shape.
 */
interface PanesActions {
  readonly aside: HTMLElement | null;
  /** Closes the open row and the phone's sheet. */
  readonly close: () => void;
  readonly setAside: (element: HTMLElement | null) => void;
  readonly setSheetBody: (element: HTMLElement | null) => void;
  readonly sheetBody: HTMLElement | null;
  /** Opens a row beside the list, or in the sheet on a phone. */
  readonly show: (id: string) => void;
  /** Opens the phone's sheet of a detail that is always on, such as the exam editor's panel. */
  readonly showSheet: () => void;
}

/** The panes of one page, with their actions. */
type PanesStore = typeof PanesState.Type & PanesActions;

/** Creates the panes of one page, with no row open and the sheet closed. */
const createPanes = () =>
  createStore<PanesStore>()((set) => ({
    aside: null,
    close: () => set({ open: Option.none(), sheet: false }),
    open: Option.none(),
    setAside: (aside) => set({ aside }),
    setSheetBody: (sheetBody) => set({ sheetBody }),
    sheet: false,
    sheetBody: null,
    show: (id) => set({ open: Option.some(id), sheet: true }),
    showSheet: () => set({ sheet: true }),
  }));

const PanesContext = createContext<StoreApi<PanesStore> | null>(null);

const PanesWidthContext = createContext<typeof PanesWidth.Type>("md");

/**
 * Where a detail draws, and how its header closes it: beside the first pane, where a row's
 * detail closes and an always-on detail does not, or in the phone's sheet, which closes itself.
 * It holds the close action, a function, so it is a plain shape.
 */
interface PaneMode {
  /** Closes the detail from its header; none for an always-on detail beside the first pane. */
  readonly close: (() => void) | undefined;
  readonly place: "aside" | "sheet";
}

const PaneModeContext = createContext<PaneMode>({
  close: undefined,
  place: "aside",
});

/** Where the detail around the caller draws, and how its header closes it. */
export function usePaneMode() {
  return use(PaneModeContext);
}

/**
 * Gives a page its two panes, created once for the page: the list or the canvas in the first,
 * and the open row or the panel in the second, beside it from `wideFrom` and in a sheet below it.
 */
export function PanesProvider({
  children,
  wideFrom = "md",
}: {
  children: ReactNode;
  wideFrom?: typeof PanesWidth.Type;
}) {
  const [store] = useState(createPanes);

  return (
    <PanesContext value={store}>
      <PanesWidthContext value={wideFrom}>{children}</PanesWidthContext>
    </PanesContext>
  );
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

/**
 * Whether the screen is wide enough for the second pane to stand beside the first. Every page with
 * panes is a School page, which renders only in the browser (ADR 0038), so the first render already
 * reads the screen and a detail that opens with the page never shows in a sheet on a wide screen.
 */
function useWide() {
  const width = use(PanesWidthContext);

  return useMediaQuery(
    width === "lg"
      ? TAILWIND_MEDIA_QUERIES.lgAndUp
      : TAILWIND_MEDIA_QUERIES.mdAndUp,
    undefined,
    { getInitialValueInEffect: false }
  );
}

/**
 * The group's width, height, and where its second pane steps aside. It fills the page up to the
 * app's widest content, `max-w-7xl`, and no further. A list's panes run from under its
 * header to the bottom of the screen, and a page whose header is taller than the school header's
 * 4rem sets `--panes-offset` to its height; the exam editor's panes fill the room its shell leaves.
 */
const panesVariants = cva("mx-auto min-h-0 w-full max-w-7xl", {
  variants: {
    fill: {
      parent: "flex-1",
      screen: "h-[calc(100svh-var(--panes-offset,4rem))]",
    },
    wideFrom: {
      lg: "max-lg:[&>[data-separator]]:hidden! max-lg:[&>[data-separator]~[data-panel]]:hidden!",
      md: "max-md:[&>[data-separator]]:hidden! max-md:[&>[data-separator]~[data-panel]]:hidden!",
    },
  },
});

/**
 * The two panes: the first, then the second beside it, each scrolling on its own, with the
 * handle between them that resizes both. The group keeps its sizes while rows open and close.
 * Below `wideFrom` the handle and the second pane step aside, so the first takes the row and
 * the second shows in a sheet.
 */
export function Panes({
  children,
  fill = "screen",
}: {
  children: ReactNode;
  fill?: "parent" | "screen";
}) {
  const wideFrom = use(PanesWidthContext);

  return (
    <ResizablePanelGroup
      className={panesVariants({ fill, wideFrom })}
      orientation="horizontal"
    >
      {children}
    </ResizablePanelGroup>
  );
}

/** The first pane: the page's list or canvas, which takes the width the second pane leaves. */
export function PanesList({ children }: { children: ReactNode }) {
  return (
    <ResizablePanel className="flex min-w-0 flex-col" id="list" minSize="40%">
      {children}
    </ResizablePanel>
  );
}

/**
 * The second pane: the handle, then the detail beside the first pane, and the phone's sheet from
 * the bottom of the screen. A row's detail says in `empty` what it will show while no row is open,
 * shows a row as it opens, and closes the row as its sheet closes. A detail without `empty` is
 * always on beside the first pane, and its sheet opens by `showSheet`. A page whose own selection
 * holds the open row passes `open` and `onClose`, and its detail closes like a row's, with or
 * without `empty`. The detail draws in one place at a time.
 */
export function PanesDetail({
  children,
  empty,
  label,
  onClose,
  open,
}: {
  /** The detail's header, body and footer. */
  children: ReactNode;
  /** What the pane shows while no row is open, in one sentence; none for an always-on detail. */
  empty?: string;
  /** The pane's name for a screen reader. */
  label: string;
  /** Closes a row that the page's own selection holds, in place of the panes' own. */
  onClose?: () => void;
  /** Whether a row that the page's own selection holds is open, in place of the panes' own. */
  open?: boolean;
}) {
  const wide = useWide();
  const rowOpen = usePanes((state) => Option.isSome(state.open));
  const sheetOpen = usePanes((state) => state.sheet);
  const closePanes = usePanes((state) => state.close);
  const isOpen = open ?? rowOpen;
  const sheet = open ?? sheetOpen;
  const close = onClose ?? closePanes;
  const closes = empty !== undefined || onClose !== undefined;
  const beside = !closes || (wide && isOpen);

  return (
    <>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="35%" id="detail" maxSize="55%" minSize="25%">
        <aside
          aria-label={label}
          className="flex h-full flex-col bg-background"
        >
          {beside ? (
            <PaneModeContext
              value={{ close: closes ? close : undefined, place: "aside" }}
            >
              {children}
            </PaneModeContext>
          ) : null}
          {beside || empty === undefined ? null : (
            <Empty className="flex-1">
              <EmptyHeader>
                <EmptyDescription>{empty}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </aside>
      </ResizablePanel>
      <Sheet
        onOpenChange={(next) => {
          if (!next) {
            close();
          }
        }}
        open={!wide && sheet}
      >
        <SheetContent className="max-h-[85svh]" side="bottom">
          {!wide && sheet ? (
            <PaneModeContext value={{ close, place: "sheet" }}>
              {children}
            </PaneModeContext>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

/**
 * The place in a detail's body where a part drawn elsewhere on the page shows, through
 * `PanePortal`: the pane beside the first only while it shows, and the phone's sheet while it is open.
 */
export function PaneTarget() {
  const wide = useWide();
  const { place } = use(PaneModeContext);
  const setAside = usePanes((state) => state.setAside);
  const setSheetBody = usePanes((state) => state.setSheetBody);

  if (place === "sheet") {
    return <div className="contents" ref={setSheetBody} />;
  }

  return <div className="contents" ref={wide ? setAside : null} />;
}

/**
 * Draws a part of the page, such as the teacher layer of the exam editor's chosen question, in
 * the detail's `PaneTarget`: the open sheet, else the pane beside the first, else nowhere.
 */
export function PanePortal({ children }: { children: ReactNode }) {
  const target = usePanes((state) => state.sheetBody ?? state.aside);

  return target === null ? null : createPortal(children, target);
}
