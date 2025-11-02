"use client";

import { Dialog as SheetPrimitive } from "@base-ui-components/react/dialog";
import { cn } from "@repo/design-system/lib/utils";
import { XIcon } from "lucide-react";
import { Activity, createContext, useContext } from "react";

const SheetContext = createContext<{
  modal: SheetPrimitive.Root.Props["modal"];
}>({
  modal: true,
});

function Sheet({ modal = true, ...props }: SheetPrimitive.Root.Props) {
  return (
    <SheetContext.Provider value={{ modal }}>
      <SheetPrimitive.Root data-slot="sheet" modal={modal} {...props} />
    </SheetContext.Provider>
  );
}

function SheetTrigger(props: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetPortal(props: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal {...props} />;
}

function SheetClose(props: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

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

function SheetPopup({
  className,
  children,
  closeButton = true,
  side = "right",
  ...props
}: SheetPrimitive.Popup.Props & {
  closeButton?: boolean;
  side?: "top" | "right" | "bottom" | "left";
}) {
  const { modal } = useContext(SheetContext);

  return (
    <SheetPortal>
      <Activity mode={modal ? "visible" : "hidden"}>
        <SheetBackdrop />
      </Activity>
      <SheetPrimitive.Popup
        className={cn(
          "fixed z-50 flex h-dvh flex-col gap-4 bg-popover text-popover-foreground shadow-lg transition-[opacity,translate,width] duration-300 ease-out will-change-transform",
          side === "right" &&
            "inset-y-0 right-0 h-full w-[calc(100%-(--spacing(12)))] max-w-sm border-l data-ending-style:translate-x-full data-starting-style:translate-x-full",
          side === "left" &&
            "data-ending-style:-translate-x-full data-starting-style:-translate-x-full inset-y-0 left-0 h-full w-[calc(100%-(--spacing(12)))] max-w-sm border-r",
          side === "top" &&
            "data-ending-style:-translate-y-full data-starting-style:-translate-y-full inset-x-0 top-0 h-auto border-b",
          side === "bottom" &&
            "inset-x-0 bottom-0 h-auto border-t data-ending-style:translate-y-full data-starting-style:translate-y-full",
          className
        )}
        data-slot="sheet-popup"
        {...props}
      >
        {children}
        {closeButton && (
          <SheetPrimitive.Close className="absolute end-2 top-2 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent opacity-72 outline-none transition-[color,background-color,box-shadow,opacity] pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0">
            <XIcon />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 p-4", className)}
      data-slot="sheet-header"
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      data-slot="sheet-footer"
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      className={cn("font-semibold", className)}
      data-slot="sheet-title"
      {...props}
    />
  );
}

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

export {
  Sheet,
  SheetTrigger,
  SheetPortal,
  SheetClose,
  SheetBackdrop,
  SheetBackdrop as SheetOverlay,
  SheetPopup,
  SheetPopup as SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
