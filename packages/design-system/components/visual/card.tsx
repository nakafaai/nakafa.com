"use client";

import {
  ArrowExpand01Icon,
  ArrowShrink02Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { useMergedRef } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@repo/design-system/components/ui/button-group";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type {
  VisualState,
  VisualStore,
} from "@repo/design-system/components/visual/store";
import { createVisualStore } from "@repo/design-system/components/visual/store";
import {
  visualBandVariants,
  visualBodyVariants,
  visualCardVariants,
} from "@repo/design-system/components/visual/variants";
import { useRequired } from "@repo/design-system/hooks/required";
import { blockGapVariants } from "@repo/design-system/lib/prose";
import type { RenderableProps } from "@repo/design-system/lib/render";
import { renderElement } from "@ui-sdk/react/primitive";
import { cn } from "cn";
import type { ComponentProps, ReactNode } from "react";
import {
  createContext,
  use,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useTranslations } from "use-intl";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

const VisualContext = createContext<VisualStore | null>(null);

/** Selects part of the surrounding card's presentation and actions. */
function useVisual<T>(selector: (state: VisualState) => T) {
  const store = useRequired(VisualContext, "useVisual");
  return useStore(store, useShallow(selector));
}

/**
 * Starts the card's scene playing, as an animation does once it first shows.
 * A scene outside a card has nothing to start.
 */
function useStartVisualScene() {
  const store = use(VisualContext);
  return () => store?.getState().play();
}

/**
 * Stops the card's scene playing, such as when a learner drags a time slider.
 * A scene outside a card has nothing to pause.
 */
function usePauseVisualScene() {
  const store = use(VisualContext);
  return () => store?.getState().pause();
}

/** Tells whether a scene renders inside a `VisualCard` store. */
function useHasVisualCard() {
  return use(VisualContext) !== null;
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
 * Runs `onReset` whenever the surrounding card's reset action increments the
 * view count, so controls, sliders and clocks restore their defaults together.
 */
function useVisualReset(onReset: () => void) {
  const view = useVisualScene((state) => state.view, 0);
  const shown = useRef(view);
  const reset = useEffectEvent(onReset);

  useEffect(() => {
    if (shown.current === view) {
      return;
    }
    shown.current = view;
    reset();
  }, [view]);
}

/**
 * Runs `onStop` whenever the surrounding card's stop or reset action increments
 * the stop count, so timelines and animations rewind to their opening frame.
 */
function useVisualStop(onStop: () => void) {
  const stopCount = useVisualScene((state) => state.stopCount, 0);
  const shown = useRef(stopCount);
  const stop = useEffectEvent(onStop);

  useEffect(() => {
    if (shown.current === stopCount) {
      return;
    }
    shown.current = stopCount;
    stop();
  }, [stopCount]);
}

/**
 * A card for one interactive visual: a 3D scene, a chart, a diagram or a
 * sketch. It composes, in this order, `VisualCardHeader`, an optional
 * `VisualCardToolbar`, `VisualCardBody`, optional `VisualCardActions`, and at
 * most one optional footer band: either `VisualCardFooter` (structured
 * key-value `VisualCardFacts`) or `VisualCardTable`, never both stacked and
 * never plain-text prose. The body holds only the visual: controls go in the
 * toolbar, buttons in the actions, and structured readouts or tables in the
 * single footer band. The toolbar and the actions hold nothing a reader cannot
 * operate: a control carries its own label and value, and any explanation goes
 * in the header's description.
 *
 * The card element itself fills the screen, so the scene inside never
 * remounts and a WebGL canvas keeps its camera. Its slot in the page keeps
 * the card's place meanwhile, so nothing behind it moves. The popups of its
 * parts open in the top layer, above the card wherever it stands.
 */
function VisualCard({
  children,
  className,
  onReset,
  ref,
  ...props
}: ComponentProps<typeof Card> & {
  /** Called whenever the card's reset action restores its initial view. */
  readonly onReset?: () => void;
}) {
  const [store] = useState(createVisualStore);
  const { bind, place, presentation, view } = useStore(
    store,
    useShallow((state) => ({
      bind: state.bind,
      place: state.place,
      presentation: state.presentation,
      view: state.view,
    }))
  );
  const shownView = useRef(view);
  const resetCard = useEffectEvent(() => {
    onReset?.();
  });
  const cardRef = useMergedRef(ref, bind);

  // Activity hides a route and unmounting removes the card; both return it
  // to the page, so the page behind never stays inert.
  useLayoutEffect(() => () => store.getState().exit(), [store]);

  useEffect(() => {
    if (shownView.current === view) {
      return;
    }
    shownView.current = view;
    resetCard();
  }, [view]);

  return (
    <VisualContext value={store}>
      <div className={blockGapVariants()} data-slot="visual-card" style={place}>
        <Card
          className={cn(
            "gap-0 py-0",
            className,
            visualCardVariants({ presentation })
          )}
          data-fullscreen={presentation === "inline" ? undefined : ""}
          ref={cardRef}
          {...props}
        >
          {children}
        </Card>
      </div>
    </VisualContext>
  );
}

/**
 * The visual's title and its description: the card says what it shows and what to look for, whatever page it stands
 * on. A figure whose contract still leaves its description optional shows its title alone when a document gives
 * none, with no empty line in its place, and one whose contract leaves its title optional draws no header when a
 * document gives none, until the contract requires both.
 */
function VisualCardHeader({
  description,
  title,
}: {
  description?: NonNullable<ReactNode> | undefined;
  title?: NonNullable<ReactNode> | undefined;
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
 * and the inputs that change what the visual shows. They wrap on a narrow card,
 * and a group of joined buttons or toggles spans the whole band. It holds only
 * controls, each with its label and value: a legend, a key, a readout or a note
 * goes in `VisualCardFooter`, and a task in the header's description.
 */
function VisualCardToolbar(props: Omit<ComponentProps<"div">, "className">) {
  return (
    <div
      className={visualBandVariants({ kind: "toolbar" })}
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
}: RenderableProps<"div">) {
  return renderElement(
    "div",
    {
      "data-slot": "visual-card-body",
      ...props,
      className: cn(visualBodyVariants(), className),
    },
    render
  );
}

/**
 * The visual's buttons, in one band under it: its one main action, such as play,
 * and `VisualCardMenu`, which ends the row with full screen and the visual's
 * other actions. A card without other actions ends the row with
 * `VisualCardFullscreen` alone. It holds buttons alone, never words beside them.
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
 * Structured key-value readouts of what the visual shows, in the single last
 * band (`VisualCardFacts` with `VisualFact` entries). Never stack a second
 * footer band or dump plain-text prose here. A table of values uses
 * `VisualCardTable` instead, as the card's sole footer band.
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
      className="border-t group-data-fullscreen/visual:shrink-0 first:border-t-0 [&_tr>*:first-child]:ps-(--card-spacing) [&_tr>*:last-child]:pe-(--card-spacing)"
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
 * Shows the card across the whole screen, and returns it to the page. It ends
 * the actions band. Its pressed state and a polite status tell assistive
 * technology where the visual is.
 */
function VisualCardFullscreen() {
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
        onClick={(event) => toggle(event.currentTarget)}
        size="icon"
        tooltip={t("fullscreen")}
        variant="secondary"
      >
        <HugeIcons icon={presented ? ArrowShrink02Icon : ArrowExpand01Icon} />
      </Button>
      <span className="sr-only" role="status">
        {presented ? t("fullscreen-shown") : null}
      </span>
    </>
  );
}

/**
 * The end of the actions band: full screen joined with a menu of the visual's
 * other actions, such as the first view back, given as menu items. The band then
 * shows two things at most, its main action and this group, however many actions
 * the visual has.
 */
function VisualCardMenu({ children }: { children: ReactNode }) {
  const t = useTranslations("Common");

  return (
    <ButtonGroup className="ms-auto" variant="secondary">
      <VisualCardFullscreen />
      <ButtonGroupSeparator />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button size="icon" tooltip={t("more-actions")} />}
        >
          <HugeIcons icon={MoreHorizontalIcon} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" label={t("menu-actions")}>
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}

export {
  useHasVisualCard,
  usePauseVisualScene,
  useStartVisualScene,
  useVisual,
  useVisualReset,
  useVisualScene,
  useVisualStop,
  VisualCard,
  VisualCardActions,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
  VisualCardMenu,
  VisualCardTable,
  VisualCardToolbar,
};
