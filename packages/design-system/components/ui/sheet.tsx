import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResizeEdge } from "@repo/design-system/components/ui/resizable";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import {
  useResizable,
  useWindowRoom,
} from "@repo/design-system/hooks/resizable";
import { ButtonGroupVariant } from "@repo/design-system/lib/group";
import { PopupContainer } from "@repo/design-system/lib/popup";
import type { NodeChildren } from "@repo/design-system/lib/render";
import {
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  Dialog as DialogPrimitive,
  DialogTitle,
  DialogTrigger,
} from "@ui-sdk/react/dialog";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps } from "react";
import { Activity, createContext, use } from "react";
import { useTranslations } from "use-intl";

const SheetContext =
  createContext<ComponentProps<typeof DialogPrimitive>["modal"]>(true);

/**
 * A panel that slides in from an edge, for details or editing beside the page. It reads as header, body and
 * footer, closes from one X in its header's top right corner, and its footer holds its sentence and its one action.
 */
function Sheet({
  modal = true,
  ...props
}: ComponentProps<typeof DialogPrimitive>) {
  return (
    <SheetContext value={modal}>
      <DialogPrimitive
        container={use(PopupContainer)}
        modal={modal}
        {...props}
      />
    </SheetContext>
  );
}

const sheetPopupVariants = cva(
  "bg-popover text-popover-foreground duration-surface fixed z-50 flex flex-col shadow-lg transition-[opacity,translate] will-change-transform [--sheet-inset:0px] has-[[data-popup-hold]]:pointer-events-none has-[[data-popup-hold]]:opacity-0 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none",
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
          "inset-x-(--sheet-inset) bottom-(--sheet-inset) h-auto max-h-[calc(100dvh-var(--sheet-inset)*2)] border-t data-ending-style:translate-y-12 data-starting-style:translate-y-12",
        left: "inset-y-(--sheet-inset) left-(--sheet-inset) h-dvh w-[calc(100%-(--spacing(12)))] max-w-sm border-r data-ending-style:-translate-x-12 data-starting-style:-translate-x-12 sm:h-[calc(100dvh-var(--sheet-inset)*2)]",
        right:
          "inset-y-(--sheet-inset) right-(--sheet-inset) h-dvh w-[calc(100%-(--spacing(12)))] max-w-sm border-l data-ending-style:translate-x-12 data-starting-style:translate-x-12 sm:h-[calc(100dvh-var(--sheet-inset)*2)]",
        top: "inset-x-(--sheet-inset) top-(--sheet-inset) h-auto max-h-[calc(100dvh-var(--sheet-inset)*2)] border-b data-ending-style:-translate-y-12 data-starting-style:-translate-y-12",
      },
    },
  }
);

/**
 * How wide a side sheet starts on a wide screen, by what it holds, in pixels: a menu, a list or a form, a wider
 * form, a document, and a table. A drag of its edge takes it from `SHEET_MIN_WIDTH` to the room the window leaves.
 */
const SHEET_WIDTHS = { lg: 672, md: 576, sm: 384, xl: 768, xs: 288 } as const;
const SHEET_MIN_WIDTH = 288;
const SHEET_MAX_WIDTH = 1024;
/** What a window keeps beside a side sheet, in pixels, so the page behind it still shows. */
const SHEET_PAGE_ROOM = 64;

function SheetBackdrop({
  className,
  ...props
}: ComponentProps<typeof DialogBackdrop>) {
  return (
    <DialogBackdrop
      className={cn(
        "duration-surface bg-ink/32 fixed inset-0 z-50 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none pointer-fine:backdrop-blur-sm",
        className
      )}
      {...props}
    />
  );
}

/**
 * Renders the positioned sheet popup and optional close affordance. A sheet
 * that sets `keepMounted` stays in the document while closed, so its content
 * can be ready before it opens. A sheet at the side of a wide screen resizes as
 * the page's pane does: its edge facing the page carries the same grip, starts
 * at the width its `size` names, and the width a reader drags it to holds in
 * this browser under `widthKey`, one per kind of sheet unless it names its own.
 */
function SheetPopup({
  className,
  children,
  keepMounted = false,
  showCloseButton = true,
  side = "right",
  inset = false,
  size = "sm",
  widthKey,
  style,
  ...props
}: NodeChildren<ComponentProps<typeof DialogContent>> & {
  keepMounted?: boolean;
  showCloseButton?: boolean;
  /** How wide the sheet starts on a wide screen: `xs` for a menu, `sm` for a list or a form, up to `xl` for a table. */
  size?: keyof typeof SHEET_WIDTHS;
  /** The name its width stays under in this browser, for a sheet that keeps a width of its own. */
  widthKey?: string;
} & VariantProps<typeof sheetPopupVariants>) {
  const modal = use(SheetContext);
  const t = useTranslations("Common");
  const room = useWindowRoom(SHEET_PAGE_ROOM);
  const anchor = side === "left" ? "start" : "end";
  const { resizerProps, width } = useResizable({
    anchor,
    initialWidth: SHEET_WIDTHS[size],
    // Never narrower than the smallest sheet, whatever the room says.
    maxWidth: Math.max(SHEET_MIN_WIDTH, Math.min(SHEET_MAX_WIDTH, room)),
    minWidth: SHEET_MIN_WIDTH,
    storageKey: widthKey ?? `nakafa-sheet-${side}-${size}`,
  });
  const sideways = side === "left" || side === "right";

  return (
    <ButtonGroupVariant value={undefined}>
      <Activity mode={modal ? "visible" : "hidden"}>
        <SheetBackdrop />
      </Activity>
      <DialogContent
        className={cn(
          sheetPopupVariants({ inset, side }),
          className,
          sideways && "sm:w-(--sheet-width) sm:max-w-none"
        )}
        data-surface="sheet"
        keepMounted={keepMounted}
        style={(state) => ({
          ...(typeof style === "function" ? style(state) : style),
          "--sheet-width": `${width}px`,
        })}
        {...props}
      >
        {/* The sheet scrolls within its frame, so its edge's grip stands across its border, outside the scroll. */}
        <div
          className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-[inherit]"
          data-slot="sheet-frame"
        >
          {children}
        </div>
        {sideways ? (
          <ResizeEdge
            anchor={anchor}
            className="max-sm:hidden"
            resizer={resizerProps}
          />
        ) : null}
        {/* The close is drawn by a Button, whose slot it wears, so the sheet names it as its own close. */}
        {!!showCloseButton && (
          <DialogClose
            className="absolute inset-e-2 top-2"
            data-sheet="close"
            render={
              <Button size="icon-sm" tooltip={t("close")} variant="ghost" />
            }
          >
            <HugeIcons icon={Cancel01Icon} />
          </DialogClose>
        )}
      </DialogContent>
    </ButtonGroupVariant>
  );
}

/** The control that opens its sheet. */
function SheetTrigger(props: ComponentProps<typeof DialogTrigger>) {
  return <DialogTrigger {...props} />;
}

/** The top of a sheet: its title and description, set off from the body by a line. */
function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-16 flex-col justify-center gap-0.5 border-b px-4 py-2.5 last:border-b-0 has-[+[data-slot=sheet-footer]]:border-b-0",
        className
      )}
      data-slot="sheet-header"
      {...props}
    />
  );
}

/** The end of a sheet: its sentence and actions, set off from the body by a line. */
function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-muted/70 mt-auto flex min-h-16 flex-col justify-center gap-2 border-t px-4 py-3",
        className
      )}
      data-slot="sheet-footer"
      {...props}
    />
  );
}

/**
 * The body of a sheet, which scrolls down between its header and its footer and never sideways. What it holds fits
 * its width, and its parts stand one gap apart.
 */
function SheetPanel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <ScrollArea className="min-h-0 flex-1 touch-auto" scrollFade>
      <div
        className={cn("flex min-w-0 flex-col gap-4 p-4", className)}
        data-slot="sheet-panel"
        {...props}
      />
    </ScrollArea>
  );
}

function SheetTitle({
  className,
  ...props
}: ComponentProps<typeof DialogTitle>) {
  return <DialogTitle className={cn("font-semibold", className)} {...props} />;
}

function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof DialogDescription>) {
  return (
    <DialogDescription
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
  SheetTrigger,
};
