import { useMediaQuery, useWindowEvent } from "@mantine/hooks";
import {
  Drawer,
  DrawerContent,
} from "@repo/design-system/components/ui/drawer";
import {
  ResizableHandle,
  ResizablePanel,
} from "@repo/design-system/components/ui/resizable";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import { Option, Schema } from "effect";
import { createContext, type ReactNode, use, useState } from "react";
import { createPortal } from "react-dom";
import { createStore, type StoreApi, useStore } from "zustand";
import {
  PanesGroupContext,
  PanesGroupProvider,
  SizedPane,
} from "@/components/shared/panes/row";
import { PaneSide } from "@/components/shared/panes/side";
import { PaneStartContext } from "@/components/shared/panes/start";
import { isTyping } from "@/components/shared/typing";

/** From which width two panes stand side by side: tablet for a list, laptop for the exam editor, wide for a chat's discussion. */
const PanesWidth = Schema.Literals(["md", "lg", "xl"]);

/** Which of the two panes keeps the row below `wideFrom`: the first, or the second once the page opens it. */
const PanesKept = Schema.Literals(["first", "second"]);

/** Whether a page's pane stands at the screen's right, not in a row under the shell. */
const PaneBesideContext = createContext(false);

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

/** Creates the panes of one page, with `opened` open, or no row and the sheet closed. */
const createPanes = (opened: Option.Option<string>) =>
  createStore<PanesStore>()((set) => ({
    aside: null,
    close: () => set({ open: Option.none(), sheet: false }),
    open: opened,
    setAside: (aside) => set({ aside }),
    setSheetBody: (sheetBody) => set({ sheetBody }),
    sheet: Option.isSome(opened),
    sheetBody: null,
    show: (id) => set({ open: Option.some(id), sheet: true }),
    showSheet: () => set({ sheet: true }),
  }));

const PanesContext = createContext<StoreApi<PanesStore> | null>(null);

const PanesWidthContext = createContext<typeof PanesWidth.Type>("xl");

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
 * A page that comes back to a row names it in `opened`, which opens it once.
 */
export function PanesProvider({
  children,
  opened = Option.none(),
  wideFrom = "xl",
}: {
  children: ReactNode;
  opened?: Option.Option<string>;
  wideFrom?: typeof PanesWidth.Type;
}) {
  const [store] = useState(() => createPanes(opened));

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
 * panes renders only in the browser (ADR 0038), so the first render already reads the screen and a
 * detail that opens with the page never shows in a sheet on a wide screen.
 */
export function useWide() {
  const width = use(PanesWidthContext);

  return useMediaQuery(TAILWIND_MEDIA_QUERIES[`${width}AndUp`], undefined, {
    getInitialValueInEffect: false,
  });
}

/**
 * The height of a page's panes, and where the second pane of a row of panes steps aside. A page's list runs from
 * under its header to the bottom of the screen, and a page with a row under its header sets `--panes-offset` to their
 * height; the exam editor's and a forum's panes fill the room their shell leaves. A page's own pane stands at the
 * screen's right (`PaneSide`), so what a list holds keeps the header's frame and a press moves nothing.
 */
const panesVariants = cva("min-h-0 w-full [--pane-end:1.5rem]", {
  compoundVariants: [
    {
      className:
        "max-md:[&>[data-separator]]:hidden! max-md:[&>[data-separator]~[data-panel]]:hidden!",
      keeps: "first",
      wideFrom: "md",
    },
    {
      className:
        "max-lg:[&>[data-separator]]:hidden! max-lg:[&>[data-separator]~[data-panel]]:hidden!",
      keeps: "first",
      wideFrom: "lg",
    },
    {
      className:
        "max-lg:[&>[data-panel]:first-child]:hidden! max-lg:[&>[data-separator]]:hidden!",
      keeps: "second",
      wideFrom: "lg",
    },
    {
      className:
        "max-xl:[&>[data-panel]:first-child]:hidden! max-xl:[&>[data-separator]]:hidden!",
      keeps: "second",
      wideFrom: "xl",
    },
  ],
  variants: {
    fill: {
      parent: "flex-1",
      screen: "h-[calc(100svh-var(--panes-offset,4rem))]",
    },
    keeps: { first: "", second: "" },
    wideFrom: { lg: "", md: "", xl: "" },
  },
});

/**
 * A page's list and its pane. The pane stands at the screen's right from the window's top (`PaneSide`), and the page
 * narrows beside it. Only the exam editor, a full-screen tool, and a forum's rail keep their panes in one row under
 * their shell (`inRow`): the first, then the second beside it, with the handle between them that resizes both, whose
 * sizes stay under `id`. Below `wideFrom`, from its provider unless the page sets it, the handle and one pane of a
 * row step aside: the second by default, or the first when `keeps` names the second, as a chat does once it is open.
 * A page's pane shows in a sheet there.
 */
export function Panes({
  children,
  fill = "screen",
  id,
  inRow = false,
  keeps = "first",
  wideFrom,
}: {
  children: ReactNode;
  fill?: "parent" | "screen";
  /** Names the layout in this browser, so each page keeps its own sizes. */
  id: string;
  /** Whether the panes stand in one row under the shell, for the exam editor and a forum's rail alone. */
  inRow?: boolean;
  keeps?: typeof PanesKept.Type;
  wideFrom?: typeof PanesWidth.Type;
}) {
  const providedWidth = use(PanesWidthContext);

  if (!inRow) {
    return (
      <div
        className={cn("flex flex-col", panesVariants({ fill }))}
        data-slot="panes"
      >
        <PanesGroupContext value={id}>
          <PaneBesideContext value={true}>{children}</PaneBesideContext>
        </PanesGroupContext>
      </div>
    );
  }

  return (
    <PanesGroupProvider
      className={panesVariants({
        fill,
        keeps,
        wideFrom: wideFrom ?? providedWidth,
      })}
      id={id}
    >
      {/* A row nested in a page whose pane stands at the screen's right, as a forum's rail and chat under a thread's
          pane, holds its own panes. */}
      <PaneBesideContext value={false}>{children}</PaneBesideContext>
    </PanesGroupProvider>
  );
}

/**
 * The rail before a page's main pane, such as a class's list of chats, and the handle that resizes it. Its smallest size
 * still holds what a rail shows above its rows, and the main pane is the `PanesList` after it.
 */
export function PanesRail({
  children,
  label,
}: {
  children: ReactNode;
  /** The pane's name for a screen reader. */
  label: string;
}) {
  return (
    <>
      <PaneStartContext value="20rem">
        <SizedPane
          className="flex min-w-0 flex-col"
          id="rail"
          maxSize="50%"
          minSize="18rem"
        >
          <aside aria-label={label} className="flex min-h-0 flex-1 flex-col">
            {children}
          </aside>
        </SizedPane>
      </PaneStartContext>
      <ResizableHandle />
    </>
  );
}

/** The page's frame around what a list holds, which the exam editor's canvas goes without. */
const paneFrameVariants = cva("", {
  defaultVariants: { wide: false },
  variants: {
    wide: {
      false: "mx-auto flex min-h-0 w-full max-w-(--page-width) flex-1 flex-col",
      true: "contents",
    },
  },
});

/** The pane that takes the width the other leaves: the page's list or canvas, or the open chat beside its rail. */
export function PanesList({
  children,
  wide = false,
}: {
  children: ReactNode;
  /** Whether what it holds takes the whole pane, as the exam editor's canvas does, not the page's frame. */
  wide?: boolean;
}) {
  const group = use(PanesGroupContext);
  const besidePage = use(PaneBesideContext);

  if (besidePage) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        <div className={paneFrameVariants({ wide })}>{children}</div>
      </div>
    );
  }

  return (
    <ResizablePanel
      className="flex min-w-0 flex-col"
      id={`${group}-list`}
      minSize="40%"
    >
      <div className={paneFrameVariants({ wide })}>{children}</div>
    </ResizablePanel>
  );
}

/**
 * The pane: the detail at the screen's right, or beside the first pane of a row, and the phone's
 * sheet from the bottom of the screen. A row's detail shows only while a row is open, so the page
 * has the whole width until a press opens one, and it closes the row as its sheet closes. An `alwaysOn`
 * detail stands there however the page reads, and its sheet opens by `showSheet`.
 * A page whose own selection holds the open row passes `open` and `onClose`, and its detail closes
 * like a row's. The detail draws in one place at a time.
 */
export function PanesDetail({
  alwaysOn = false,
  children,
  label,
  onClose,
  open,
}: {
  /** Whether the detail stands beside the first pane with no row open, as the exam editor's panel does. */
  alwaysOn?: boolean;
  /** The detail's header, body and footer. */
  children: ReactNode;
  /** The pane's name for a screen reader. */
  label: string;
  /** Closes a row that the page's own selection holds, in place of the panes' own. */
  onClose?: () => void;
  /** Whether a row that the page's own selection holds is open, in place of the panes' own. */
  open?: boolean;
}) {
  const wide = useWide();
  const group = use(PanesGroupContext);
  const besidePage = use(PaneBesideContext);
  const from = use(PanesWidthContext);
  const rowOpen = usePanes((state) => Option.isSome(state.open));
  const sheetOpen = usePanes((state) => state.sheet);
  const closePanes = usePanes((state) => state.close);
  const isOpen = open ?? rowOpen;
  const sheet = open ?? sheetOpen;
  const close = onClose ?? closePanes;
  const beside = besidePage
    ? wide && (alwaysOn || isOpen)
    : alwaysOn || (wide && isOpen);
  const closes = beside && !alwaysOn;

  // Escape closes a row that stands open, unless a popup over it or a field in it took the key.
  useWindowEvent("keydown", (event) => {
    if (
      event.key === "Escape" &&
      closes &&
      !(event.defaultPrevented || event.isComposing || isTyping(event.target))
    ) {
      event.preventDefault();
      close();
    }
  });

  return (
    <>
      {beside && besidePage ? (
        <PaneSide from={from} group={group} label={label} row={closes}>
          <PaneModeContext
            value={{ close: alwaysOn ? undefined : close, place: "aside" }}
          >
            {children}
          </PaneModeContext>
        </PaneSide>
      ) : null}
      {beside && !besidePage ? (
        <>
          <ResizableHandle />
          <PaneStartContext value="35%">
            <SizedPane id="detail" maxSize="55%" minSize="25%">
              <aside
                aria-label={label}
                className="bg-background flex h-full flex-col"
                data-pane-row={closes ? "" : undefined}
              >
                <PaneModeContext
                  value={{
                    close: alwaysOn ? undefined : close,
                    place: "aside",
                  }}
                >
                  {children}
                </PaneModeContext>
              </aside>
            </SizedPane>
          </PaneStartContext>
        </>
      ) : null}
      <Drawer
        onOpenChange={(next) => {
          if (!next) {
            close();
          }
        }}
        open={!wide && sheet}
      >
        <DrawerContent>
          <PaneModeContext value={{ close, place: "sheet" }}>
            {children}
          </PaneModeContext>
        </DrawerContent>
      </Drawer>
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
