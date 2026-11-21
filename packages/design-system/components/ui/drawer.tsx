import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { ButtonGroupVariant } from "@repo/design-system/lib/group";
import { PopupContainer } from "@repo/design-system/lib/popup";
import type { NodeChildren } from "@repo/design-system/lib/render";
import { attachSheetGrip } from "@repo/design-system/lib/sheet";
import {
  DrawerBackdrop,
  DrawerContent as DrawerContentPrimitive,
  DrawerDescription as DrawerDescriptionPrimitive,
  DrawerHandle,
  Drawer as DrawerPrimitive,
  DrawerTitle as DrawerTitlePrimitive,
} from "@ui-sdk/react/drawer";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps } from "react";
import { use } from "react";
import { useTranslations } from "use-intl";

/**
 * A sheet that rises from an edge of the screen, the one surface every drawer wears: as wide as the screen from the
 * bottom, rounded on its top corners, or as tall as the screen from a side, rounded on its inner corners, with its
 * handle at the edge it leaves by. It matches the sheet a menu or a select becomes on a phone (`sheetSurface`), so a
 * phone shows one kind of sheet. It closes as an iPhone sheet does, by its handle, a swipe or a press outside, so every
 * drawer draws the handle and none draws a close button. It follows the finger with the platform's spring, over a page
 * that stays where it is.
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
 * The drawer's surface, over a dim on the page. Its colour is `--drawer-surface`, which a drawer of another colour,
 * such as the sidebar's, sets in place of a background. A drag past the resting edge stretches the drawer on by up to
 * 24px (UI SDK's rubber band), so a fill of the surface's colour stands past that edge, drawn as a hard shadow, which
 * the surface's own clip leaves alone. The surface clears the home indicator and the notch by their safe areas; a
 * footer that ends the drawer (`DrawerFooter`) takes the bottom one onto its tinted band instead. A sheet that rises
 * over it makes it step back as every sheet does (`sheetSurface`). It opens with the
 * focus on itself, so a screen reader names the drawer first, never its handle, and a phone raises no keyboard.
 */
function DrawerContent({
  children,
  className,
  ...props
}: NodeChildren<ComponentProps<typeof DrawerContentPrimitive>>) {
  const t = useTranslations("Common");

  return (
    <ButtonGroupVariant value={undefined}>
      <DrawerBackdrop className="bg-ink/30 fixed inset-0 z-50" />
      <DrawerContentPrimitive
        className={cn(
          "group/drawer text-popover-foreground border-border z-50 flex min-h-0 origin-top [transform:translateY(calc(var(--drawer-stack,0)*(-0.75rem-max(0px,var(--sheet-front-height,0px)-100%))))_scale(calc(1-var(--drawer-stack,0)*0.04))] flex-col overflow-hidden bg-(--drawer-surface) pb-[env(safe-area-inset-bottom)] text-sm outline-none [--drawer-surface:var(--color-popover)] has-[[data-slot=drawer-footer]]:pb-0",
          "data-[side=bottom]:max-h-[calc(var(--visual-viewport-height,100dvh)-3rem)] data-[side=bottom]:rounded-t-3xl data-[side=bottom]:border-t data-[side=bottom]:shadow-[0_2rem_0_var(--drawer-surface)]",
          "data-[side=top]:max-h-[calc(var(--visual-viewport-height,100dvh)-3rem)] data-[side=top]:rounded-b-3xl data-[side=top]:border-b data-[side=top]:pt-[env(safe-area-inset-top)] data-[side=top]:shadow-[0_-2rem_0_var(--drawer-surface)]",
          "data-[side=left]:w-3/4 data-[side=left]:flex-row-reverse data-[side=left]:rounded-e-3xl data-[side=left]:border-e data-[side=left]:ps-[env(safe-area-inset-left)] data-[side=left]:pt-[env(safe-area-inset-top)] data-[side=left]:shadow-[-2rem_0_0_var(--drawer-surface)] data-[side=right]:w-3/4 data-[side=right]:flex-row data-[side=right]:rounded-s-3xl data-[side=right]:border-s data-[side=right]:pe-[env(safe-area-inset-right)] data-[side=right]:pt-[env(safe-area-inset-top)] data-[side=right]:shadow-[2rem_0_0_var(--drawer-surface)] sm:data-[side=left]:w-96 sm:data-[side=right]:w-96",
          className
        )}
        initialFocus="content"
        {...props}
      >
        <DrawerHandle
          aria-label={t("resize-drawer")}
          className="after:bg-muted focus-visible:after:bg-ring flex shrink-0 cursor-grab touch-none items-center justify-center outline-none group-data-[side=bottom]/drawer:h-5 group-data-[side=left]/drawer:w-4 group-data-[side=right]/drawer:w-4 group-data-[side=top]/drawer:order-last group-data-[side=top]/drawer:h-5 after:rounded-full group-data-[side=bottom]/drawer:after:h-1.5 group-data-[side=bottom]/drawer:after:w-25 group-data-[side=left]/drawer:after:h-25 group-data-[side=left]/drawer:after:w-1.5 group-data-[side=right]/drawer:after:h-25 group-data-[side=right]/drawer:after:w-1.5 group-data-[side=top]/drawer:after:h-1.5 group-data-[side=top]/drawer:after:w-25 active:cursor-grabbing"
          ref={attachSheetGrip}
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
 * The actions, on the tinted, ruled band a dialog's footer stands on, which runs on under the home indicator and clears
 * it by its safe area. Stacked, each action is as wide as the drawer: a caller writes the way out first and the main
 * action last, as a dialog's row reads, so the column turns them over and the main action stands on top, as in
 * shadcn's own. In a row, the actions keep their own widths and stand at the end, as a pane's footer holds them.
 */
const drawerFooterVariants = cva(
  "bg-muted/70 mt-auto flex shrink-0 gap-2 border-t p-4 pb-[max(--spacing(4),env(safe-area-inset-bottom))]",
  {
    defaultVariants: { layout: "stack" },
    variants: {
      layout: {
        row: "items-center justify-end",
        stack: "flex-col-reverse [&>[data-slot=button]]:w-full",
      },
    },
  }
);

function DrawerFooter({
  className,
  layout,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof drawerFooterVariants>) {
  return (
    <div
      className={cn(drawerFooterVariants({ layout }), className)}
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
