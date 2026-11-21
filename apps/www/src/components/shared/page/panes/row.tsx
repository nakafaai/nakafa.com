import { useLocalStorage } from "@mantine/hooks";
import {
  ResizablePanel,
  ResizablePanelGroup,
} from "@repo/design-system/components/ui/resizable";
import { Array as Arr, Option, Record as Rec, Schema } from "effect";
import type { ComponentProps, ReactNode } from "react";
import { use, useRef, useState } from "react";
import { PanesGroupContext } from "@/components/shared/page/panes/group";
import type { PaneSize } from "@/components/shared/page/panes/start";
import { PaneStartContext } from "@/components/shared/page/panes/start";

/** The share of a group's width each sized pane took when a person last moved its handle, by the pane's ID. */
const PaneSizes = Schema.Record(Schema.String, Schema.Finite);

const decodePaneSizes = Schema.decodeUnknownOption(
  Schema.fromJsonString(PaneSizes)
);

/**
 * The sizes a person gave a group's panes, kept in this browser. The first render reads them, so a pane opens at its
 * kept size in the frame the page first paints and nothing moves after it. A browser that keeps nothing starts from each
 * pane's own size.
 */
function useKeptSizes(group: string) {
  return useLocalStorage<typeof PaneSizes.Type>({
    defaultValue: {},
    deserialize: (value) =>
      Option.getOrElse(decodePaneSizes(value), () => ({})),
    getInitialValueInEffect: false,
    key: `nakafa-panes-${group}`,
  });
}

/**
 * A row of panes whose sizes stay: what a person sets with a handle holds across a reload. Only a person's own move is
 * kept, so a window that narrows a pane for a moment leaves their size alone. Every two-pane layout of Nakafa is one of
 * these: `Panes` for a page's list and its detail, and the player for its questions and their navigator.
 */
export function PanesGroupProvider({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className: string;
  /** Names the layout in this browser, so each page keeps its own sizes. */
  id: string;
}) {
  const [, keepSizes] = useKeptSizes(id);
  const row = useRef<HTMLDivElement>(null);

  return (
    <ResizablePanelGroup
      className={className}
      onLayoutCommit={(layout, { reason }) => {
        if (reason === "resize" || reason === "imperative") {
          return;
        }
        // The layout lists each pane's share in the row's order, so the panes' IDs, in the same order, name them.
        const ids = Array.from(
          row.current?.querySelectorAll<HTMLElement>(
            ':scope > [data-slot="resizable-panel"]'
          ) ?? [],
          (pane) => pane.id
        );
        keepSizes(Rec.fromEntries(Arr.zip(ids, layout)));
      }}
      orientation="horizontal"
      ref={row}
    >
      <PanesGroupContext value={id}>{children}</PanesGroupContext>
    </ResizablePanelGroup>
  );
}

/**
 * A pane with its own size, which starts at the size a person kept for it, read once as it opens, or else at the size
 * of its `PaneStartContext`. The pane that takes the room the others leave is a plain `ResizablePanel`.
 */
export function SizedPane({
  id,
  ...props
}: Omit<ComponentProps<typeof ResizablePanel>, "defaultSize" | "id"> & {
  id: string;
}) {
  const group = use(PanesGroupContext);
  const fallback = use(PaneStartContext);
  const [sizes] = useKeptSizes(group);
  const [start] = useState(() =>
    Option.match(Rec.get(sizes, `${group}-${id}`), {
      onNone: () => fallback,
      onSome: (kept): PaneSize => `${kept}%`,
    })
  );

  return (
    <ResizablePanel defaultSize={start} id={`${group}-${id}`} {...props} />
  );
}
