"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { CancelIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps } from "react";

const DialogCreateHandle = DialogPrimitive.createHandle;

function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger(props: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal(props: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose(props: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      className={cn(
        "data-closed:fade-out-0 data-open:fade-in-0 fixed inset-0 isolate z-50 bg-black/20 duration-150 data-closed:animate-out data-open:animate-in supports-backdrop-filter:backdrop-blur-sm",
        className
      )}
      data-slot="dialog-overlay"
      {...props}
    />
  );
}

function DialogViewport({
  className,
  ...props
}: DialogPrimitive.Viewport.Props) {
  return (
    <DialogPrimitive.Viewport
      className={cn(
        "fixed inset-0 z-50 grid grid-rows-[1fr_auto_3fr] justify-items-center p-4 max-sm:grid-rows-[1fr_auto] max-sm:p-0 max-sm:pt-12",
        className
      )}
      data-slot="dialog-viewport"
      {...props}
    />
  );
}

function DialogContent({
  bottomStickOnMobile = true,
  className,
  children,
  closeProps,
  portalProps,
  size = "default",
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  bottomStickOnMobile?: boolean;
  closeProps?: DialogPrimitive.Close.Props;
  portalProps?: DialogPrimitive.Portal.Props;
  size?: "default" | "wide";
  showCloseButton?: boolean;
}) {
  const { className: closeClassName, ...closeButtonProps } = closeProps ?? {};

  return (
    <DialogPortal {...portalProps}>
      <DialogOverlay />
      <DialogViewport
        className={cn(
          !bottomStickOnMobile && "max-sm:grid-rows-[1fr_auto_3fr] max-sm:p-4"
        )}
      >
        <DialogPrimitive.Popup
          className={cn(
            "data-closed:fade-out-0 data-closed:zoom-out-98 data-open:fade-in-0 data-open:zoom-in-98 relative row-start-2 flex max-h-[min(90dvh,900px)] min-h-0 w-full max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground text-sm shadow-lg/5 outline-none duration-150 data-closed:animate-out data-open:animate-in",
            size === "default" && "sm:max-w-md",
            size === "wide" && "sm:max-w-7xl",
            bottomStickOnMobile &&
              "max-sm:data-closed:slide-out-to-bottom-4 max-sm:data-open:slide-in-from-bottom-4 max-sm:max-w-none max-sm:origin-bottom max-sm:rounded-t-xl max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0",
            className
          )}
          data-slot="dialog-content"
          {...props}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              aria-label="Close"
              className={cn("absolute top-2 right-2", closeClassName)}
              data-slot="dialog-close"
              render={<Button size="icon-sm" variant="ghost" />}
              {...closeButtonProps}
            >
              <HugeIcons data-icon="icon" icon={CancelIcon} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Popup>
      </DialogViewport>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-2 p-6 pb-3 max-sm:pb-4", className)}
      data-slot="dialog-header"
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  variant = "default",
  ...props
}: ComponentProps<"div"> & {
  showCloseButton?: boolean;
  variant?: "bare" | "default";
}) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 px-6 sm:flex-row sm:justify-end max-sm:[&>[data-slot=button]]:w-full",
        variant === "default" && "border-t bg-muted/70 py-4",
        variant === "bare" && "pt-3 pb-6",
        className
      )}
      data-slot="dialog-footer"
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogPanel({
  className,
  scrollFade = true,
  scrollbarGutter = true,
  ...props
}: ComponentProps<"div"> & {
  scrollFade?: boolean;
  scrollbarGutter?: boolean;
}) {
  return (
    <ScrollArea
      className="min-h-0 flex-1 touch-auto"
      scrollbarGutter={scrollbarGutter}
      scrollFade={scrollFade}
    >
      <div
        className={cn("min-w-0 p-6 pt-1", className)}
        data-slot="dialog-panel"
        {...props}
      />
    </ScrollArea>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      className={cn("font-semibold text-xl leading-none", className)}
      data-slot="dialog-title"
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      className={cn(
        "text-muted-foreground text-sm *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      data-slot="dialog-description"
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogContent as DialogPopup,
  DialogCreateHandle,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay as DialogBackdrop,
  DialogOverlay,
  DialogPanel,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  DialogViewport,
};
