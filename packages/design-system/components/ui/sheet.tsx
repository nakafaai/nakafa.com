"use client";

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@repo/design-system/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Activity, createContext, useContext } from "react";
import { HugeIcons } from "./huge-icons";

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

const sheetPopupVariants = cva(
  "fixed z-50 flex flex-col gap-4 overflow-y-auto bg-popover text-popover-foreground shadow-lg transition-[opacity,translate,width] duration-200 ease-out will-change-transform [--sheet-inset:0px] data-ending-style:opacity-0 data-starting-style:opacity-0",
  {
    defaultVariants: {
      inset: false,
      side: "right",
    },
    variants: {
      inset: {
        true: "sm:rounded-xl sm:[--sheet-inset:1rem]",
      },
      side: {
        bottom:
          "inset-x-[var(--sheet-inset)] bottom-[var(--sheet-inset)] h-auto max-h-[calc(100dvh-var(--sheet-inset)*2)] border-t data-ending-style:translate-y-12 data-starting-style:translate-y-12",
        left: "inset-y-[var(--sheet-inset)] left-[var(--sheet-inset)] h-dvh w-[calc(100%-(--spacing(12)))] max-w-sm border-r data-ending-style:-translate-x-12 data-starting-style:-translate-x-12 sm:h-[calc(100dvh-var(--sheet-inset)*2)]",
        right:
          "inset-y-[var(--sheet-inset)] right-[var(--sheet-inset)] h-dvh w-[calc(100%-(--spacing(12)))] max-w-sm border-l data-ending-style:translate-x-12 data-starting-style:translate-x-12 sm:h-[calc(100dvh-var(--sheet-inset)*2)]",
        top: "inset-x-[var(--sheet-inset)] top-[var(--sheet-inset)] h-auto max-h-[calc(100dvh-var(--sheet-inset)*2)] border-b data-ending-style:-translate-y-12 data-starting-style:-translate-y-12",
      },
    },
  }
);

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
  showCloseButton = true,
  side = "right",
  inset = false,
  ...props
}: SheetPrimitive.Popup.Props & {
  showCloseButton?: boolean;
} & VariantProps<typeof sheetPopupVariants>) {
  const { modal } = useContext(SheetContext);

  return (
    <SheetPortal>
      <Activity mode={modal ? "visible" : "hidden"}>
        <SheetBackdrop />
      </Activity>
      <SheetPrimitive.Popup
        className={cn(sheetPopupVariants({ inset, side }), className)}
        data-slot="sheet-popup"
        {...props}
      >
        {children}
        {!!showCloseButton && (
          <SheetPrimitive.Close className="absolute end-2 top-2 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent opacity-72 outline-none transition-[color,background-color,box-shadow,opacity] pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0">
            <HugeIcons icon={Cancel01Icon} />
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
  sheetPopupVariants,
};
