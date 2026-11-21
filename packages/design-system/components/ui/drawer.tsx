import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { StagedPopup } from "@repo/design-system/components/ui/staged";
import { ButtonGroupVariant } from "@repo/design-system/lib/group";
import { PopupContainer } from "@repo/design-system/lib/popup";
import type { NodeChildren } from "@repo/design-system/lib/render";
import { releaseSheetExit } from "@repo/design-system/lib/sheet";
import {
  DrawerBackdrop,
  DrawerContent as DrawerContentPrimitive,
  DrawerDescription as DrawerDescriptionPrimitive,
  DrawerHandle,
  Drawer as DrawerPrimitive,
  DrawerTitle as DrawerTitlePrimitive,
} from "@ui-sdk/react/drawer";
import { cn } from "cn";
import type { ComponentProps } from "react";
import { use } from "react";

/**
 * A sheet that rises from an edge of the screen in the floating style of an iPhone sheet: a card that stands off every
 * edge, rounded on every corner, with its handle at the edge it leaves by. It closes as that sheet does, by its
 * handle, a swipe or a press outside, so every drawer draws the handle and none draws a close button. It follows the
 * finger with the platform's spring, and the page behind it scales back as it opens (`DrawerStage`).
 */
function Drawer({
  side = "bottom",
  ...props
}: ComponentProps<typeof DrawerPrimitive>) {
  return (
    <DrawerPrimitive container={use(PopupContainer)} side={side} {...props} />
  );
}

/**
 * The dim over the page while a drawer is open. It draws no backdrop blur: the page under it scales back as the
 * drawer opens (`DrawerStage`), and a blur over a page that moves is computed again every frame.
 */
function DrawerContent({
  children,
  className,
  ...props
}: NodeChildren<ComponentProps<typeof DrawerContentPrimitive>>) {
  return (
    <ButtonGroupVariant value={undefined}>
      <DrawerBackdrop className="bg-ink/30 fixed inset-0 z-50" />
      <DrawerContentPrimitive
        className={cn(
          "group/drawer bg-popover text-popover-foreground dark:border-border border-popover z-50 m-2 mb-[max(--spacing(2),env(safe-area-inset-bottom))] flex min-h-0 flex-col overflow-hidden rounded-3xl border text-sm shadow-xl outline-none",
          "data-[side=bottom]:max-h-[calc(100dvh-6rem)] data-[side=top]:max-h-[calc(100dvh-6rem)]",
          "data-[side=left]:w-3/4 data-[side=left]:flex-row-reverse data-[side=right]:w-3/4 data-[side=right]:flex-row sm:data-[side=left]:w-96 sm:data-[side=right]:w-96",
          className
        )}
        render={(contentProps, state) => (
          <StagedPopup {...contentProps} open={state.open} />
        )}
        {...props}
      >
        <DrawerHandle
          className="after:bg-muted focus-visible:after:bg-ring flex shrink-0 cursor-grab touch-none items-center justify-center outline-none group-data-[side=bottom]/drawer:h-5 group-data-[side=left]/drawer:w-4 group-data-[side=right]/drawer:w-4 group-data-[side=top]/drawer:order-last group-data-[side=top]/drawer:h-5 after:rounded-full group-data-[side=bottom]/drawer:after:h-1.5 group-data-[side=bottom]/drawer:after:w-25 group-data-[side=left]/drawer:after:h-25 group-data-[side=left]/drawer:after:w-1.5 group-data-[side=right]/drawer:after:h-25 group-data-[side=right]/drawer:after:w-1.5 group-data-[side=top]/drawer:after:h-1.5 group-data-[side=top]/drawer:after:w-25 active:cursor-grabbing"
          ref={releaseSheetExit}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </DrawerContentPrimitive>
    </ButtonGroupVariant>
  );
}

/** The title and its description, ruled off from what follows, as a dialog's and a sheet's header are. */
function DrawerHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-0.5 border-b p-4 group-data-[side=bottom]/drawer:pt-0 group-data-[side=bottom]/drawer:text-center last:border-b-0 has-[+[data-slot=drawer-footer]]:border-b-0 md:gap-1.5",
        className
      )}
      data-slot="drawer-header"
      {...props}
    />
  );
}

/**
 * The body of a drawer. What it holds keeps its edges and stands apart, as a form's fields do. A `fill` body
 * does not scroll: what it holds shrinks to the height the drawer leaves and scrolls on its own, so the drawer
 * never holds a scroll inside a scroll.
 */
function DrawerPanel({
  className,
  fill = false,
  ...props
}: ComponentProps<"div"> & { fill?: boolean }) {
  if (fill) {
    return (
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-4",
          className
        )}
        data-slot="drawer-panel"
        {...props}
      />
    );
  }
  return (
    <ScrollArea className="min-h-0 flex-1" scrollFade>
      <div
        className={cn("flex min-w-0 flex-col gap-4 p-4", className)}
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

function DrawerTitle({
  className,
  ...props
}: ComponentProps<typeof DrawerTitlePrimitive>) {
  return (
    <DrawerTitlePrimitive
      className={cn("text-foreground text-base font-medium", className)}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: ComponentProps<typeof DrawerDescriptionPrimitive>) {
  return (
    <DrawerDescriptionPrimitive
      className={cn("text-muted-foreground text-sm text-balance", className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerPanel,
  DrawerTitle,
};
