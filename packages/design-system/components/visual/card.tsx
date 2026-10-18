"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import {
  ArrowExpand01Icon,
  ArrowShrink02Icon,
} from "@hugeicons/core-free-icons";
import { useMergedRef } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  createVisualStore,
  type VisualState,
  type VisualStore,
} from "@repo/design-system/components/visual/store";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  use,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

const VisualContext = createContext<VisualStore | null>(null);

/** Selects part of the surrounding card's presentation and actions. */
function useVisual<T>(selector: (state: VisualState) => T) {
  const store = use(VisualContext);
  if (!store) {
    // A missing card is a programmer composition error at this React seam.
    throw new Error("Visual card parts require VisualCard.");
  }
  return useStore(store, useShallow(selector));
}

/** A scene outside a card has no store to follow. */
const followNothing = () => () => undefined;

/**
 * Reads one primitive of the surrounding card's scene state: whether it plays,
 * or how many times its view was reset. A scene drawn outside a card, such as
 * a stand-in, stays still at its first view.
 */
function useVisualScene<T extends boolean | number>(
  select: (state: VisualState) => T,
  still: T
) {
  const store = use(VisualContext);
  return useSyncExternalStore(
    store ? store.subscribe : followNothing,
    () => (store ? select(store.getState()) : still),
    () => still
  );
}

/**
 * Off-screen cards skip rendering, and both full screen presentations fill
 * the screen. The browser's top layer places and sizes a Fullscreen API
 * element. The immersive card covers the dynamic viewport itself: in the top
 * layer where the browser has popovers, and above the page's own sticky bars
 * where it does not. Presentation classes come last, so a card's own classes
 * never undo them.
 *
 * The card is never a scroll anchor. WebKit can anchor the page to content
 * inside the card while it sits in the page, and keeps following that anchor
 * once the card fills the screen, so the page behind scrolls whenever a chart
 * or scene in the card resizes.
 */
const visualCardVariants = cva(
  "group/visual @container/visual content-auto-card [overflow-anchor:none]",
  {
    compoundVariants: [
      // The screen-filling surface that both full screen presentations share.
      // The card's own margins stay with its slot in the page, and its bands
      // keep their spacing inside the safe area.
      {
        className:
          "m-0 overflow-y-auto overscroll-contain rounded-none pt-[env(safe-area-inset-top,0px)] pr-[env(safe-area-inset-right,0px)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] shadow-none ring-0",
        presentation: ["fullscreen", "immersive"],
      },
    ],
    variants: {
      presentation: {
        fullscreen: "",
        immersive: "fixed inset-0 z-60 h-dvh w-auto border-0",
        inline: "",
      },
    },
  }
);

/**
 * The bands of a visual card, top to bottom: the header, an optional toolbar,
 * the body that holds only the visual, optional actions, and the footer with
 * what the visual shows. A line divides each band from the one above it, and
 * every band keeps the card's inset, so every visual reads the same way.
 */
const visualBandVariants = cva(
  "border-t px-(--card-spacing) first:border-t-0 group-data-fullscreen/visual:shrink-0",
  {
    variants: {
      kind: {
        // Rows of controls or buttons: as tall as a button and its breath.
        controls: "flex flex-wrap items-center gap-2 py-3",
        // Text: the card's own spacing above and below.
        text: "flex flex-col gap-3 py-(--card-spacing) text-sm",
      },
    },
  }
);

/**
 * The body holds the visual alone, edge to edge. In full screen the body of the
 * card takes the free height and drops its aspect ratio, and size containment
 * keeps a chart's own aspect ratio from claiming more than the screen has. The
 * body is then a column, so a chart or a scene that grows into the free space
 * fills it, or keeps its minimum while the card scrolls. A body laid out as a
 * grid says so for full screen too (`[[data-fullscreen]>&]:grid`). A body inside
 * another body, such as a scene loaded into its frame, fills that body and adds
 * no line.
 */
const visualBodyVariants = cva(
  "relative border-t first:border-t-0 [[data-fullscreen]>&]:flex [[data-fullscreen]>&]:aspect-auto [[data-fullscreen]>&]:min-h-64 [[data-fullscreen]>&]:flex-1 [[data-fullscreen]>&]:flex-col [[data-fullscreen]>&]:contain-size [[data-slot=visual-card-body]>&]:size-full [[data-slot=visual-card-body]>&]:border-t-0"
);

/**
 * A card for one interactive visual: a 3D scene, a chart, a diagram or a
 * sketch. It composes, in this order, `VisualCardHeader`, an optional
 * `VisualCardToolbar`, `VisualCardBody`, optional `VisualCardActions`, and an
 * optional `VisualCardFooter`. The body holds only the visual: controls go in
 * the toolbar, buttons in the actions, and readouts, legends, tables and notes
 * in the footer.
 *
 * The card element itself fills the screen, so the scene inside never
 * remounts and a WebGL canvas keeps its camera. Its slot in the page keeps
 * the card's place meanwhile, so nothing behind it moves.
 */
function VisualCard({ className, ref, ...props }: ComponentProps<typeof Card>) {
  const [store] = useState(createVisualStore);
  const { bind, place, presentation } = useStore(
    store,
    useShallow((state) => ({
      bind: state.bind,
      place: state.place,
      presentation: state.presentation,
    }))
  );
  const cardRef = useMergedRef(ref, bind);

  // Activity hides a route and unmounting removes the card; both return it
  // to the page, so the page behind never stays inert.
  useLayoutEffect(() => () => store.getState().exit(), [store]);

  return (
    <VisualContext value={store}>
      <div data-slot="visual-card" style={place}>
        <Card
          className={cn(
            "gap-0 py-0",
            className,
            visualCardVariants({ presentation })
          )}
          data-fullscreen={presentation === "inline" ? undefined : ""}
          ref={cardRef}
          {...props}
        />
      </div>
    </VisualContext>
  );
}

/**
 * The visual's title and, when it has one, its description. A visual without a
 * title draws no header, because the page around it already names the visual.
 */
function VisualCardHeader({
  description,
  title,
}: {
  description?: ReactNode;
  title?: ReactNode;
}) {
  if (title === undefined) {
    return null;
  }

  return (
    <CardHeader className="py-(--card-spacing) group-data-fullscreen/visual:shrink-0">
      <CardTitle>{title}</CardTitle>
      {description === undefined ? null : (
        <CardDescription>{description}</CardDescription>
      )}
    </CardHeader>
  );
}

/**
 * The visual's own controls, in one band above it: sliders, choices, toggles
 * and the inputs that change what the visual shows. They wrap on a narrow card.
 */
function VisualCardToolbar(props: Omit<ComponentProps<"div">, "className">) {
  return (
    <div
      className={visualBandVariants({ kind: "controls" })}
      data-slot="visual-card-toolbar"
      {...props}
    />
  );
}

/**
 * The visual itself and nothing else: the scene, the chart, the diagram or the
 * sketch, edge to edge. A canvas or chart inside follows the body's size, which
 * takes the free height in full screen.
 */
function VisualCardBody({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { className: cn(visualBodyVariants(), className) },
      props
    ),
    render,
    state: { slot: "visual-card-body" },
  });
}

/**
 * The visual's buttons, in one band under it: play, reset, the steps, and the
 * full screen action, which ends the row.
 */
function VisualCardActions(props: Omit<ComponentProps<"div">, "className">) {
  return (
    <div
      className={visualBandVariants({ kind: "controls" })}
      data-slot="visual-card-actions"
      {...props}
    />
  );
}

/**
 * What the visual shows, in words and numbers, in the last band: its readouts
 * (`VisualCardFacts`), a legend, or a short note. A table of values is its own
 * band (`VisualCardTable`), so its rows run the card's full width.
 */
function VisualCardFooter(props: Omit<ComponentProps<"div">, "className">) {
  return (
    <div
      className={visualBandVariants({ kind: "text" })}
      data-slot="visual-card-footer"
      {...props}
    />
  );
}

/**
 * A table of the visual's values as its own band, edge to edge like a data table: every
 * row and its border runs the card's full width, and the first and last cell of a row keep
 * the card's spacing from its edges. A table never sits inside the padded footer, where
 * its rows would stop short of the card's edges. A wide table scrolls inside the band.
 */
function VisualCardTable(props: Omit<ComponentProps<"div">, "className">) {
  return (
    <div
      className="border-t first:border-t-0 group-data-fullscreen/visual:shrink-0 [&_tr>*:first-child]:ps-(--card-spacing) [&_tr>*:last-child]:pe-(--card-spacing)"
      data-slot="visual-card-table"
      {...props}
    />
  );
}

/**
 * The readouts of a visual in its footer: a grid of `VisualFact` terms and
 * values in two columns at every width, so every row is full. A card gives an
 * even number of readouts; a lone last one spans both columns.
 */
function VisualCardFacts(props: Omit<ComponentProps<"dl">, "className">) {
  return (
    <dl
      className="grid grid-cols-2 gap-x-6 gap-y-3 [&>:last-child:nth-child(odd)]:col-span-2"
      data-slot="visual-card-facts"
      {...props}
    />
  );
}

/**
 * A group of one kind of control in the toolbar, such as the speeds or the
 * generations, kept together when the toolbar wraps.
 */
function VisualCardGroup(props: Omit<ComponentProps<"div">, "className">) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-slot="visual-card-group"
      {...props}
    />
  );
}

/**
 * Shows the card across the whole screen, and returns it to the page. It ends
 * the actions band. Its pressed state and a polite status tell assistive
 * technology where the visual is. A static stand-in of the visual passes
 * `inert`, so the button takes no focus until the visual is mounted.
 */
function VisualCardFullscreen({ inert = false }: { inert?: boolean }) {
  const t = useTranslations("Common");
  const { presented, toggle } = useVisual((state) => ({
    presented: state.presentation !== "inline",
    toggle: state.toggle,
  }));

  return (
    <>
      <Button
        aria-pressed={presented}
        className="ms-auto shrink-0"
        inert={inert}
        onClick={(event) => toggle(event.currentTarget)}
        size="icon"
        variant="secondary"
      >
        <HugeIcons icon={presented ? ArrowShrink02Icon : ArrowExpand01Icon} />
        <span className="sr-only">{t("fullscreen")}</span>
      </Button>
      <span className="sr-only" role="status">
        {presented ? t("fullscreen-shown") : null}
      </span>
    </>
  );
}

export {
  useVisual,
  useVisualScene,
  VisualCard,
  VisualCardActions,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardGroup,
  VisualCardHeader,
  VisualCardTable,
  VisualCardToolbar,
};
