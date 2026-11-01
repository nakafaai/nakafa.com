import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { StagedPopup } from "@repo/design-system/components/ui/staged";
import { cn } from "cn";
import { type ComponentProps, createContext, use } from "react";

const DrawerContext = createContext<{
  hasSnapPoints: boolean;
  modal: DrawerPrimitive.Root.Props["modal"];
  showSwipeHandle: boolean;
  swipeDirection: NonNullable<DrawerPrimitive.Root.Props["swipeDirection"]>;
} | null>(null);

/** Reads the root of the surrounding drawer. */
function useDrawer() {
  const context = use(DrawerContext);

  if (context === null) {
    throw new Error("useDrawer must be used within a Drawer.");
  }

  return context;
}

/**
 * shadcn's Base UI drawer in its floating style: a card that stands off every edge of the
 * screen, rounded on every corner, with the swipe handle at its top, as an iPhone sheet looks.
 * https://ui.shadcn.com/docs/components/base/drawer
 */
function Drawer({
  modal = true,
  showSwipeHandle = false,
  snapPoints,
  swipeDirection = "down",
  ...props
}: DrawerPrimitive.Root.Props & {
  showSwipeHandle?: boolean;
}) {
  return (
    <DrawerContext
      value={{
        hasSnapPoints: (snapPoints?.length ?? 0) > 0,
        modal,
        showSwipeHandle,
        swipeDirection,
      }}
    >
      <DrawerPrimitive.Root
        data-slot="drawer"
        modal={modal}
        snapPoints={snapPoints}
        swipeDirection={swipeDirection}
        {...props}
      />
    </DrawerContext>
  );
}

function DrawerTrigger(props: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal(props: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose(props: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerOverlay({
  className,
  ...props
}: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      className={cn(
        "fixed inset-0 z-50 min-h-dvh bg-black/30 opacity-[max(var(--drawer-overlay-min-opacity,0),calc(1-var(--drawer-swipe-progress)))] transition-opacity duration-450 ease-[cubic-bezier(0.32,0.72,0,1)] select-none data-ending-style:pointer-events-none data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-snap-points:[--drawer-overlay-min-opacity:0.5] data-starting-style:opacity-0 data-swiping:duration-0 supports-backdrop-filter:backdrop-blur-xs supports-[-webkit-touch-callout:none]:absolute",
        className
      )}
      data-slot="drawer-overlay"
      {...props}
    />
  );
}

function DrawerSwipeHandle({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "after:bg-muted relative z-10 flex shrink-0 cursor-grab transition-opacity duration-200 group-data-nested-drawer-open/drawer-popup:opacity-0 group-data-nested-drawer-swiping/drawer-popup:opacity-100 group-data-[swipe-axis=x]/drawer-popup:h-full group-data-[swipe-axis=x]/drawer-popup:w-3 group-data-[swipe-axis=x]/drawer-popup:items-center group-data-[swipe-axis=y]/drawer-popup:h-3 group-data-[swipe-axis=y]/drawer-popup:w-full group-data-[swipe-axis=y]/drawer-popup:justify-center group-data-[swipe-direction=down]/drawer-popup:items-end group-data-[swipe-direction=left]/drawer-popup:order-last group-data-[swipe-direction=left]/drawer-popup:justify-start group-data-[swipe-direction=right]/drawer-popup:justify-end group-data-[swipe-direction=up]/drawer-popup:order-last group-data-[swipe-direction=up]/drawer-popup:items-start after:block after:shrink-0 after:rounded-full group-data-[swipe-axis=x]/drawer-popup:after:h-25 group-data-[swipe-axis=x]/drawer-popup:after:w-1.5 group-data-[swipe-axis=y]/drawer-popup:after:h-1.5 group-data-[swipe-axis=y]/drawer-popup:after:w-25 active:cursor-grabbing",
        className
      )}
      data-slot="drawer-swipe-handle"
      {...props}
    />
  );
}

/**
 * Records where the page was scrolled as a drawer opens, so the page behind it scales back from the top of
 * the visible screen (`DrawerStage`). The scroll lock then moves the scroll from the root to the body, so the
 * larger of the two is the page's. The value stays after the drawer closes, while the page scales back up.
 */
function recordStageScroll(node: HTMLDivElement | null) {
  if (node === null) {
    return;
  }
  const root = document.documentElement;
  root.style.setProperty(
    "--drawer-stage-scroll",
    `${Math.max(root.scrollTop, document.body.scrollTop)}px`
  );
}

/**
 * The floating card, over the overlay. It stands above an iPhone's home indicator, and the page behind it
 * scales back as it opens (`DrawerStage`).
 */
function DrawerContent({
  children,
  className,
  ...props
}: Omit<DrawerPrimitive.Popup.Props, "ref">) {
  const { hasSnapPoints, modal, showSwipeHandle, swipeDirection } = useDrawer();
  const swipeAxis =
    swipeDirection === "down" || swipeDirection === "up" ? "y" : "x";

  return (
    <DrawerPortal>
      {modal === true && (
        <DrawerOverlay data-snap-points={hasSnapPoints ? "" : undefined} />
      )}
      <DrawerPrimitive.Viewport
        className="pointer-events-none fixed inset-0 z-50 select-none data-[modal=true]:pointer-events-auto"
        data-modal={modal}
        data-slot="drawer-viewport"
      >
        <DrawerPrimitive.Popup
          className={cn(
            // Base.
            "group/drawer-popup border-popover bg-popover text-popover-foreground dark:border-border pointer-events-auto fixed z-50 m-(--drawer-inset,0px) flex h-(--drawer-content-height) max-h-(--drawer-content-max-height,none) min-h-0 w-(--drawer-content-width,auto) transform-[translate3d(var(--translate-x,0px),var(--translate-y,0px),0)_scale(var(--stack-scale))] flex-col rounded-3xl border text-sm shadow-xl transition-[transform,height,opacity,filter] duration-450 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform outline-none select-none [--drawer-bleed-background:transparent] [--drawer-inset:--spacing(2)] [--drawer-stacked-shadow:0_-20px_25px_-5px_rgb(0_0_0/0.1),0_-8px_10px_-6px_rgb(0_0_0/0.1)] [interpolate-size:allow-keywords] data-[swipe-direction=down]:data-nested-drawer-open:shadow-(--drawer-stacked-shadow)",
            // Nested.
            "data-nested-drawer-open:overflow-hidden data-nested-drawer-open:brightness-95",
            // Bleed.
            "after:pointer-events-none after:absolute after:bg-(--drawer-bleed-background,var(--color-popover)) data-[swipe-axis=x]:after:inset-y-0 data-[swipe-axis=x]:after:w-(--bleed) data-[swipe-axis=y]:after:inset-x-0 data-[swipe-axis=y]:after:h-(--bleed) data-[swipe-direction=down]:after:top-full data-[swipe-direction=left]:after:right-full data-[swipe-direction=right]:after:left-full data-[swipe-direction=up]:after:bottom-full",
            // Sizing.
            "[--drawer-content-height:var(--drawer-height,auto)] data-[swipe-axis=x]:[--drawer-content-width:75%] data-[swipe-axis=y]:[--drawer-content-max-height:calc(100dvh-6rem)] data-[swipe-axis=y]:data-snap-points:[--drawer-content-height:100dvh] data-[swipe-axis=x]:sm:[--drawer-content-width:24rem]",
            // Stack.
            "[--bleed:3rem] [--peek:1rem] [--stack-height:var(--drawer-frontmost-height,var(--drawer-height,0px))] [--stack-peek-offset:max(0px,calc((var(--nested-drawers)-var(--stack-progress))*var(--peek)))] [--stack-progress:clamp(0,var(--drawer-swipe-progress),1)] [--stack-scale-base:max(0,calc(1-(var(--nested-drawers)*var(--stack-step))))] [--stack-scale:clamp(0,calc(var(--stack-scale-base)+(var(--stack-step)*var(--stack-progress))),1)] [--stack-shrink:calc(1-var(--stack-scale))] [--stack-step:0.05]",
            // Transitions.
            "data-ending-style:transform-(--closed-transform) data-ending-style:opacity-[0.9999] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-nested-drawer-swiping:duration-0 data-ending-style:data-nested-drawer-swiping:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:transform-(--closed-transform) data-swiping:duration-0 data-ending-style:data-swiping:duration-[calc(var(--drawer-swipe-strength)*400ms)]",
            // Axis: y.
            "data-[swipe-axis=y]:inset-x-0 data-[swipe-axis=y]:data-nested-drawer-open:h-(--stack-height)",
            // Axis: x.
            "data-[swipe-axis=x]:inset-y-0 data-[swipe-axis=x]:flex-row",
            // Direction: down.
            "data-[swipe-direction=down]:bottom-[env(safe-area-inset-bottom,0px)] data-[swipe-direction=down]:origin-bottom data-[swipe-direction=down]:[--closed-transform:translate3d(0,calc(100%+var(--drawer-inset,0px)+env(safe-area-inset-bottom,0px)+2px),0)] data-[swipe-direction=down]:[--translate-y:calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y)-var(--stack-peek-offset)-(var(--stack-shrink)*var(--stack-height)))]",
            // Direction: up.
            "data-[swipe-direction=up]:top-0 data-[swipe-direction=up]:origin-top data-[swipe-direction=up]:[--closed-transform:translate3d(0,calc(-100%-var(--drawer-inset,0px)-2px),0)] data-[swipe-direction=up]:[--translate-y:calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y)+var(--stack-peek-offset)+(var(--stack-shrink)*var(--stack-height)))]",
            // Direction: left.
            "data-[swipe-direction=left]:left-0 data-[swipe-direction=left]:origin-left data-[swipe-direction=left]:[--closed-transform:translate3d(calc(-100%-var(--drawer-inset,0px)-2px),0,0)] data-[swipe-direction=left]:[--translate-x:calc(var(--drawer-swipe-movement-x)+var(--stack-peek-offset)+(var(--stack-shrink)*100%))]",
            // Direction: right.
            "data-[swipe-direction=right]:right-0 data-[swipe-direction=right]:origin-right data-[swipe-direction=right]:[--closed-transform:translate3d(calc(100%+var(--drawer-inset,0px)+2px),0,0)] data-[swipe-direction=right]:[--translate-x:calc(var(--drawer-swipe-movement-x)-var(--stack-peek-offset)-(var(--stack-shrink)*100%))]",
            className
          )}
          data-slot="drawer-popup"
          data-snap-points={hasSnapPoints ? "" : undefined}
          data-swipe-axis={swipeAxis}
          render={(popupProps, state) => (
            <StagedPopup {...popupProps} open={state.open} />
          )}
          {...props}
          ref={recordStageScroll}
        >
          {showSwipeHandle ? <DrawerSwipeHandle /> : null}
          <DrawerPrimitive.Content
            className="flex min-h-0 flex-1 flex-col overflow-hidden overscroll-contain rounded-[inherit] transition-opacity duration-300 ease-[cubic-bezier(0.45,1.005,0,1.005)] select-text group-data-nested-drawer-open/drawer-popup:opacity-0 group-data-nested-drawer-swiping/drawer-popup:opacity-100 group-data-swiping/drawer-popup:select-none"
            data-slot="drawer-content"
          >
            {children}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPortal>
  );
}

/** The title and its description, ruled off from what follows, as a dialog's and a sheet's header are. */
function DrawerHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-0.5 border-b p-4 group-data-[swipe-axis=y]/drawer-popup:text-center last:border-b-0 has-[+[data-slot=drawer-footer]]:border-b-0 md:gap-1.5 md:text-left",
        className
      )}
      data-slot="drawer-header"
      {...props}
    />
  );
}

/**
 * The body between the header and the footer, which scrolls on its own and fades at its edges. Its height
 * comes from what it holds, up to what the drawer leaves for it. The scroller is the flex item itself, because a
 * drawer only caps its height: a percentage inside a wrapper resolves to nothing, and the form then runs under the footer.
 */
/** The body of a drawer. What it holds keeps its edges and stands apart, as a form's fields do. */
function DrawerPanel({ className, ...props }: ComponentProps<"div">) {
  return (
    <ScrollArea className="min-h-0 flex-1 touch-auto" scrollFade>
      <div
        className={cn("flex min-w-0 flex-col gap-6 p-4", className)}
        data-slot="drawer-panel"
        {...props}
      />
    </ScrollArea>
  );
}

/**
 * The actions, stacked on the tinted, ruled band a dialog's footer stands on. A caller writes the way out first
 * and the main action last, as a dialog's row reads, so the column turns them over and the main action stands on
 * top, as in shadcn's own.
 */
function DrawerFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-muted/70 mt-auto flex shrink-0 flex-col-reverse gap-2 border-t p-4 [&>[data-slot=button]]:w-full",
        className
      )}
      data-slot="drawer-footer"
      {...props}
    />
  );
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      className={cn("text-foreground text-base font-medium", className)}
      data-slot="drawer-title"
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      className={cn("text-muted-foreground text-sm text-balance", className)}
      data-slot="drawer-description"
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPanel,
  DrawerPortal,
  DrawerSwipeHandle,
  DrawerTitle,
  DrawerTrigger,
};
