"use client";

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { cn } from "@repo/design-system/lib/utils";
import type React from "react";
import { Activity, createContext, use, useMemo } from "react";

type SheetSide = "bottom" | "left" | "right" | "top";
type SheetVariant = "default" | "inset";

const SheetContext = createContext<{
  modal: SheetPrimitive.Root.Props["modal"];
}>({
  modal: true,
});

/** Provides the Base UI dialog root for a COSS side-panel sheet. */
function Sheet({ modal = true, ...props }: SheetPrimitive.Root.Props) {
  const contextValue = useMemo(() => ({ modal }), [modal]);

  return (
    <SheetContext.Provider value={contextValue}>
      <SheetPrimitive.Root data-slot="sheet" modal={modal} {...props} />
    </SheetContext.Provider>
  );
}

/** Renders the trigger slot without adding button semantics for callers. */
function SheetTrigger(props: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

/** Forwards COSS portal props such as container and keepMounted. */
function SheetPortal(props: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal {...props} />;
}

/** Renders a close control that can compose with a COSS Button. */
function SheetClose(props: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

/** Renders the optional modal backdrop for blocking sheets. */
function SheetBackdrop({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      className={cn(
        "fixed inset-0 z-50 bg-black/32 backdrop-blur-sm transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0",
        className
      )}
      data-slot="sheet-backdrop"
      {...props}
    />
  );
}

/** Positions a sheet popup on the requested viewport edge. */
function SheetViewport({
  className,
  side,
  variant = "default",
  ...props
}: SheetPrimitive.Viewport.Props & {
  side?: SheetSide;
  variant?: SheetVariant;
}): React.ReactElement {
  return (
    <SheetPrimitive.Viewport
      className={cn(
        "fixed inset-0 z-50 grid",
        side === "bottom" && "grid grid-rows-[1fr_auto] pt-12",
        side === "top" && "grid grid-rows-[auto_1fr] pb-12",
        side === "left" && "flex justify-start",
        side === "right" && "flex justify-end",
        variant === "inset" && "sm:p-4",
        className
      )}
      data-slot="sheet-viewport"
      {...props}
    />
  );
}

/** Renders the positioned COSS sheet popup and its optional close affordance. */
function SheetPopup({
  className,
  children,
  showCloseButton = true,
  side = "right",
  variant = "default",
  closeProps,
  portalProps,
  ...props
}: SheetPrimitive.Popup.Props & {
  showCloseButton?: boolean;
  side?: SheetSide;
  variant?: SheetVariant;
  closeProps?: SheetPrimitive.Close.Props;
  portalProps?: SheetPrimitive.Portal.Props;
}) {
  const { modal } = use(SheetContext);

  return (
    <SheetPortal {...portalProps}>
      <Activity mode={modal ? "visible" : "hidden"}>
        <SheetBackdrop />
      </Activity>
      <SheetViewport side={side} variant={variant}>
        <SheetPrimitive.Popup
          className={cn(
            "relative flex max-h-full min-h-0 w-full min-w-0 flex-col bg-popover not-dark:bg-clip-padding text-popover-foreground shadow-lg/5 transition-[opacity,translate,width] duration-200 ease-in-out will-change-transform before:pointer-events-none before:absolute before:inset-0 before:shadow-[0_1px_--theme(--color-black/4%)] data-ending-style:opacity-0 data-starting-style:opacity-0 max-sm:before:hidden dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
            side === "bottom" &&
              "row-start-2 border-t data-ending-style:translate-y-8 data-starting-style:translate-y-8",
            side === "top" &&
              "border-b data-ending-style:-translate-y-8 data-starting-style:-translate-y-8",
            side === "left" &&
              "w-[calc(100%-(--spacing(12)))] max-w-md border-e data-ending-style:-translate-x-8 data-starting-style:-translate-x-8",
            side === "right" &&
              "col-start-2 w-[calc(100%-(--spacing(12)))] max-w-md border-s data-ending-style:translate-x-8 data-starting-style:translate-x-8",
            variant === "inset" &&
              "before:hidden sm:rounded-2xl sm:border sm:before:rounded-[calc(var(--radius-2xl)-1px)] sm:**:data-[slot=sheet-footer]:rounded-b-[calc(var(--radius-2xl)-1px)]",
            className
          )}
          data-slot="sheet-popup"
          {...props}
        >
          {children}
          {!!showCloseButton && (
            <SheetPrimitive.Close
              aria-label="Close"
              className="absolute end-2 top-2"
              render={<Button size="icon" variant="ghost" />}
              {...closeProps}
            >
              <HugeIcons icon={Cancel01Icon} />
            </SheetPrimitive.Close>
          )}
        </SheetPrimitive.Popup>
      </SheetViewport>
    </SheetPortal>
  );
}

/** Renders the sheet heading section while preserving popup layout spacing. */
function SheetHeader({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">): React.ReactElement {
  const defaultProps = {
    className: cn(
      "flex flex-col gap-2 p-6 in-[[data-slot=sheet-popup]:has([data-slot=sheet-panel])]:pb-3 max-sm:pb-4",
      className
    ),
    "data-slot": "sheet-header",
  };

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render,
  });
}

/** Renders footer actions with default framed or bare COSS spacing. */
function SheetFooter({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"div"> & {
  variant?: "bare" | "default";
}): React.ReactElement {
  const defaultProps = {
    className: cn(
      "flex flex-col-reverse gap-2 px-6 sm:flex-row sm:justify-end",
      variant === "default" && "border-t bg-muted/72 py-4",
      variant === "bare" &&
        "in-[[data-slot=sheet-popup]:has([data-slot=sheet-panel])]:pt-3 pt-4 pb-6",
      className
    ),
    "data-slot": "sheet-footer",
  };

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render,
  });
}

/** Renders the required accessible sheet title. */
function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      className={cn(
        "font-heading font-semibold text-xl leading-none",
        className
      )}
      data-slot="sheet-title"
      {...props}
    />
  );
}

/** Renders passive supporting copy for the sheet title. */
function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="sheet-description"
      {...props}
    />
  );
}

/** Renders the scrollable body panel between sheet header and footer. */
function SheetPanel({
  className,
  scrollFade = true,
  render,
  ...props
}: useRender.ComponentProps<"div"> & {
  scrollFade?: boolean;
}): React.ReactElement {
  const defaultProps = {
    className: cn(
      "p-6 in-[[data-slot=sheet-popup]:has([data-slot=sheet-header])]:pt-1 in-[[data-slot=sheet-popup]:has([data-slot=sheet-footer]:not(.border-t))]:pb-1",
      className
    ),
    "data-slot": "sheet-panel",
  };

  return (
    <ScrollArea scrollFade={scrollFade}>
      {useRender({
        defaultTagName: "div",
        props: mergeProps<"div">(defaultProps, props),
        render,
      })}
    </ScrollArea>
  );
}

export {
  Sheet,
  SheetBackdrop,
  SheetClose,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
  SheetViewport,
};
