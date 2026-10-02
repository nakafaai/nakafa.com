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
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  createVisualStore,
  type VisualState,
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
} from "react";
import { type StoreApi, useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

const VisualContext = createContext<StoreApi<VisualState> | null>(null);

/** Selects part of the surrounding card's presentation and actions. */
function useVisual<T>(selector: (state: VisualState) => T) {
  const store = use(VisualContext);
  if (!store) {
    // A missing card is a programmer composition error at this React seam.
    throw new Error("Visual card parts require VisualCard.");
  }
  return useStore(store, useShallow(selector));
}

/**
 * Screen-filling surface shared by both full screen presentations. The card's
 * own margins stay with its slot in the page.
 */
const FULL_SCREEN =
  "m-0 overflow-y-auto overscroll-contain rounded-none pt-[calc(var(--card-spacing)+env(safe-area-inset-top,0px))] pr-[env(safe-area-inset-right,0px)] pb-[calc(var(--card-spacing)+env(safe-area-inset-bottom,0px))] pl-[env(safe-area-inset-left,0px)] shadow-none ring-0";

/**
 * Off-screen cards skip rendering, and both full screen presentations fill
 * the screen. The browser's top layer places and sizes a Fullscreen API
 * element. The immersive card covers the dynamic viewport itself: in the top
 * layer where the browser has popovers, and above the page's own sticky bars
 * where it does not. Presentation classes come last, so a card's own classes
 * never undo them.
 */
const visualCardVariants = cva("group/visual content-auto-card", {
  variants: {
    presentation: {
      fullscreen: FULL_SCREEN,
      immersive: [FULL_SCREEN, "fixed inset-0 z-60 h-dvh w-auto border-0"],
      inline: "",
    },
  },
});

const visualBodyVariants = cva(
  "group-data-fullscreen/visual:flex-1 group-data-fullscreen/visual:justify-center"
);

/**
 * In full screen the card sizes the scene: size containment keeps a chart's
 * aspect ratio from claiming more height than the screen has, so the scene
 * fills the free height, or keeps its minimum while the card scrolls.
 */
const visualSceneVariants = cva(
  "group-data-fullscreen/visual:flex group-data-fullscreen/visual:aspect-auto group-data-fullscreen/visual:min-h-64 group-data-fullscreen/visual:flex-1 group-data-fullscreen/visual:flex-col group-data-fullscreen/visual:contain-size"
);

/**
 * A card for one interactive visual, with a full screen action in its footer.
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
          className={cn(className, visualCardVariants({ presentation }))}
          data-fullscreen={presentation === "inline" ? undefined : ""}
          ref={cardRef}
          {...props}
        />
      </div>
    </VisualContext>
  );
}

/** The visual's title and, when it has one, its description. */
function VisualCardHeader({
  description,
  title,
}: {
  description?: ReactNode;
  title: ReactNode;
}) {
  return (
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      {description === undefined ? null : (
        <CardDescription>{description}</CardDescription>
      )}
    </CardHeader>
  );
}

/** Holds the visual and its inline controls; it takes the free height in full screen. */
function VisualCardBody({
  className,
  ...props
}: ComponentProps<typeof CardContent>) {
  return (
    <CardContent className={cn(visualBodyVariants(), className)} {...props} />
  );
}

/**
 * The scene, chart, or diagram itself, or a wrapper around it. It keeps its
 * own frame in the page and takes the free height in full screen, where a
 * canvas or chart follows its size. A scene inside another scene fills it.
 */
function VisualCardScene({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { className: cn(visualSceneVariants(), className) },
      props
    ),
    render,
    state: { slot: "visual-card-scene" },
  });
}

/** The bordered footer for the visual's own controls and its full screen action. */
function VisualCardFooter({
  className,
  ...props
}: ComponentProps<typeof CardFooter>) {
  return (
    <CardFooter
      className={cn("items-start gap-4 border-t", className)}
      {...props}
    />
  );
}

/**
 * Shows the card across the whole screen, and returns it to the page. Its
 * pressed state and a polite status tell assistive technology where the
 * visual is.
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
  VisualCard,
  VisualCardBody,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
  VisualCardScene,
};
