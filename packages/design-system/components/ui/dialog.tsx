import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { SheetGrip } from "@repo/design-system/components/ui/sheet-grip";
import { ButtonGroupVariant } from "@repo/design-system/lib/group";
import { PopupContainer, sheetSurface } from "@repo/design-system/lib/popup";
import type { NodeChildren } from "@repo/design-system/lib/render";
import { keepTabInside } from "@repo/design-system/lib/trap";
import {
  DialogBackdrop,
  DialogClose,
  DialogContent as DialogContentPrimitive,
  DialogDescription as DialogDescriptionPrimitive,
  Dialog as DialogPrimitive,
  DialogTitle as DialogTitlePrimitive,
} from "@ui-sdk/react/dialog";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps } from "react";
import { use } from "react";
import { useTranslations } from "use-intl";

/**
 * A dialog over the page. On a wide or a mouse screen it stands in the middle with its close in the top right corner;
 * on a phone it rises from the bottom as a sheet, which closes as an iPhone sheet does, by its handle, a swipe or a
 * press outside, so it draws no close button. One tree holds both, so a dialog keeps its fields as the screen turns.
 */
function Dialog({
  presentation = "auto",
  ...props
}: ComponentProps<typeof DialogPrimitive>) {
  return (
    <DialogPrimitive
      container={use(PopupContainer)}
      presentation={presentation}
      {...props}
    />
  );
}

/**
 * How big a dialog stands in the middle of the screen: `default` keeps to a reading width and the height of what it
 * holds, and `wide`, for a canvas such as a diagram, takes most of a wide screen. Each size is one width under the
 * screen's less a margin, `min()` in one declaration, and scoped to the dialog's presentation as the rest of its
 * frame is, so no breakpoint utility competes with it: an attribute variant outranks a breakpoint, and a dialog
 * capped only at `sm:` stood the screen's whole width.
 */
const dialogSize = cva("", {
  variants: {
    size: {
      default:
        "data-[presentation=dialog]:h-fit data-[presentation=dialog]:max-w-[min(28rem,calc(100%-2rem))]",
      wide: "data-[presentation=dialog]:h-[min(90dvh,900px)] data-[presentation=dialog]:max-w-[min(80rem,calc(100%-2rem))]",
    },
  },
});

function DialogContent({
  className,
  children,
  onKeyDown,
  size = "default",
  ...props
}: NodeChildren<ComponentProps<typeof DialogContentPrimitive>> & {
  size?: NonNullable<VariantProps<typeof dialogSize>["size"]>;
}) {
  const t = useTranslations("Common");

  return (
    <ButtonGroupVariant value={undefined}>
      <DialogBackdrop className="bg-ink/20 duration-surface fixed inset-0 z-50 transition-opacity ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none pointer-fine:backdrop-blur-sm" />
      <DialogContentPrimitive
        className={cn(
          "group/dialog bg-popover text-popover-foreground z-50 flex min-h-0 w-full flex-col overflow-clip border text-sm shadow-lg/5 outline-none has-[[data-popup-hold]]:pointer-events-none has-[[data-popup-hold]]:opacity-0",
          "data-[presentation=dialog]:duration-surface data-[presentation=dialog]:fixed data-[presentation=dialog]:inset-0 data-[presentation=dialog]:m-auto data-[presentation=dialog]:max-h-[min(90dvh,900px)] data-[presentation=dialog]:rounded-xl data-[presentation=dialog]:transition-[opacity,scale] data-[presentation=dialog]:ease-out data-[presentation=dialog]:data-ending-style:opacity-0 data-[presentation=dialog]:data-starting-style:opacity-0 data-[presentation=dialog]:motion-safe:data-ending-style:scale-98 data-[presentation=dialog]:motion-safe:data-starting-style:scale-98",
          sheetSurface(),
          dialogSize({ size }),
          className
        )}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          keepTabInside(event);
        }}
        {...props}
      >
        <SheetGrip />
        {children}
        <DialogClose
          className="absolute top-2 right-2 group-data-[presentation=sheet]/dialog:hidden"
          render={
            <Button size="icon-sm" tooltip={t("close")} variant="ghost" />
          }
        >
          <HugeIcons icon={Cancel01Icon} />
        </DialogClose>
      </DialogContentPrimitive>
    </ButtonGroupVariant>
  );
}

function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-b p-6 pb-4 group-data-[presentation=sheet]/dialog:gap-0.5 group-data-[presentation=sheet]/dialog:p-4 group-data-[presentation=sheet]/dialog:pt-0 group-data-[presentation=sheet]/dialog:text-center last:border-b-0 has-[+[data-slot=dialog-footer]]:border-b-0",
        className
      )}
      data-slot="dialog-header"
      {...props}
    />
  );
}

/**
 * The actions, on a tinted, ruled band. On a sheet they stack, the main action on top and as wide as the sheet; in a
 * dialog they stand in a row, the main action last.
 */
function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-muted/70 flex shrink-0 flex-col-reverse gap-2 border-t px-6 py-4 group-data-[presentation=sheet]/dialog:p-4 group-data-[presentation=dialog]/dialog:sm:flex-row group-data-[presentation=dialog]/dialog:sm:justify-end group-data-[presentation=sheet]/dialog:[&>[data-slot=button]]:w-full",
        className
      )}
      data-slot="dialog-footer"
      {...props}
    />
  );
}

/**
 * The body of a dialog, which scrolls down and never sideways: what it holds fits its width, and its parts stand one
 * gap apart, as a form's fields do. A `fill` body does not scroll: it gives its height to what it holds, such as a
 * diagram that scrolls on its own, so the dialog never holds a scroll inside a scroll.
 */
function DialogPanel({
  className,
  fill = false,
  ...props
}: ComponentProps<"div"> & {
  fill?: boolean;
}) {
  if (fill) {
    return (
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-6 group-data-[presentation=sheet]/dialog:p-4",
          className
        )}
        data-slot="dialog-panel"
        {...props}
      />
    );
  }
  return (
    <ScrollArea className="min-h-0 flex-1" scrollFade>
      <div
        className={cn(
          "flex min-w-0 flex-col gap-4 p-6 group-data-[presentation=sheet]/dialog:p-4",
          className
        )}
        data-slot="dialog-panel"
        {...props}
      />
    </ScrollArea>
  );
}

function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogTitlePrimitive>) {
  return (
    <DialogTitlePrimitive
      className={cn(
        "text-xl leading-none font-semibold group-data-[presentation=sheet]/dialog:text-base group-data-[presentation=sheet]/dialog:leading-normal group-data-[presentation=sheet]/dialog:font-medium",
        className
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogDescriptionPrimitive>) {
  return (
    <DialogDescriptionPrimitive
      className={cn(
        "text-muted-foreground *:[a]:hover:text-foreground text-sm text-balance *:[a]:underline *:[a]:underline-offset-3",
        className
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
};
