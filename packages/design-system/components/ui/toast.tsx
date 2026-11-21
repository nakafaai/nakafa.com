import {
  Alert02Icon,
  Cancel01Icon,
  InformationCircleIcon,
  SadDizzyIcon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { buttonVariants } from "@repo/design-system/lib/button";
import type { ToastType } from "@ui-sdk/react/toast";
import {
  createToaster,
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastRegion,
  ToastTitle,
} from "@ui-sdk/react/toast";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import { useTranslations } from "use-intl";

/**
 * The places a toast stands, each its own queue: the bottom end of the screen, where a toast stays clear of the
 * page's work; the bottom center, for a page whose end holds its own controls, such as a player; and the top
 * center, for a notice about a composer at the bottom, which a toast there would cover on a phone.
 */
export const toasters = {
  "bottom-center": createToaster(),
  "bottom-end": createToaster(),
  "top-center": createToaster(),
} as const;

/** Where each queue's stack stands on the screen. */
const PLACES = {
  "bottom-center": { align: "center", side: "bottom" },
  "bottom-end": { align: "end", side: "bottom" },
  "top-center": { align: "center", side: "top" },
} as const;

const toastRegionVariants = cva(
  "fixed z-100 h-(--toast-front-height) w-[min(22rem,calc(100vw-2rem))] font-sans transition-[height] duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] data-expanded:h-[calc(var(--toast-stack-height)+(var(--toast-count)-1)*0.5rem)] motion-reduce:transition-none [&>ol]:relative [&>ol]:m-0 [&>ol]:h-full [&>ol]:list-none [&>ol]:p-0",
  {
    variants: {
      align: {
        center: "left-1/2 -translate-x-1/2",
        end: "end-4",
      },
      side: {
        bottom:
          "bottom-[calc(1rem+env(safe-area-inset-bottom)+var(--keyboard-inset,0px))]",
        top: "top-[calc(1rem+env(safe-area-inset-top))]",
      },
    },
  }
);

/**
 * One toast of the stack. The newest stands in front and the older ones peek out behind it, smaller and with their
 * words hidden, until the pointer or focus enters the stack, which then fans out. A status toast keeps its status border and is filled with 15% of its
 * status color over the popover, so its kind reads before its words; its text stays the popover's. A swipe toward the
 * edge follows the finger and dismisses it.
 */
const toastVariants = cva(
  "group/toast bg-popover text-popover-foreground focus-visible:ring-ring data-[type=error]:border-destructive data-[type=info]:border-info data-[type=success]:border-success data-[type=warning]:border-warning absolute inset-x-0 z-[calc(100-var(--toast-index))] flex h-(--toast-height) [translate:var(--toast-swipe-x,0px)_calc(var(--y)+var(--toast-swipe-y,0px))] [scale:calc(1-var(--toast-index)*0.05)] items-center gap-1.5 rounded-md border p-4 text-[13px] shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-[translate,scale,opacity,height] duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] outline-none select-none *:transition-opacity not-data-expanded:not-data-front:h-(--toast-front-height) not-data-expanded:not-data-front:*:opacity-0 focus-visible:ring-2 focus-visible:ring-inset data-ending-style:opacity-0 data-expanded:[scale:1] data-starting-style:transition-none data-starting-style:not-data-front:opacity-0 data-swiping:transition-none data-[type=error]:bg-[color-mix(in_oklab,var(--destructive)_15%,var(--popover))] data-[type=info]:bg-[color-mix(in_oklab,var(--info)_15%,var(--popover))] data-[type=success]:bg-[color-mix(in_oklab,var(--success)_15%,var(--popover))] data-[type=warning]:bg-[color-mix(in_oklab,var(--warning)_15%,var(--popover))] motion-reduce:transition-opacity",
  {
    variants: {
      /** The edge the stack grows from: the older toasts peek out and fan away from it. */
      side: {
        bottom:
          "bottom-0 [--y:calc(var(--toast-index)*-0.75rem)] data-expanded:[--y:calc(-1*(var(--toast-offset)+var(--toast-index)*0.5rem))] data-starting-style:data-front:[--y:100%]",
        top: "top-0 [--y:calc(var(--toast-index)*0.75rem)] data-expanded:[--y:calc(var(--toast-offset)+var(--toast-index)*0.5rem)] data-starting-style:data-front:[--y:-100%]",
      },
    },
  }
);

/** The status icon of a toast, decorative, since the toast's words say its kind. A plain toast shows none. */
function ToastIcon({ type }: { type: ToastType }) {
  if (type === "default") {
    return null;
  }
  if (type === "loading") {
    return <Spinner className="-ms-0.75 me-1 shrink-0" />;
  }
  const icon = {
    error: SadDizzyIcon,
    info: InformationCircleIcon,
    success: Tick01Icon,
    warning: Alert02Icon,
  }[type];
  return (
    <HugeIcons
      aria-hidden
      className="group-data-[type=error]/toast:text-destructive group-data-[type=info]/toast:text-info group-data-[type=success]/toast:text-success group-data-[type=warning]/toast:text-warning -ms-0.75 me-1 shrink-0"
      icon={icon}
    />
  );
}

/**
 * One stack of toasts at its place on the screen. A toast hidden behind the front one of a closed stack is inert, so
 * Tab never lands on a button no one can see. F6 moves focus to the newest toast and back.
 */
function ToastStack({ place }: { place: keyof typeof toasters }) {
  const t = useTranslations("Common");
  const { align, side } = PLACES[place];

  return (
    <ToastRegion
      align={align}
      aria-label={t("notifications")}
      className={toastRegionVariants({ align, side })}
      pendingAnnouncement={t("loading")}
      side={side}
      toaster={toasters[place]}
    >
      {(toast) => (
        <Toast
          className={toastVariants({ side })}
          render={(props, state) => (
            <li
              {...props}
              inert={
                state.leaving || (!state.expanded && state.index > 0)
                  ? true
                  : undefined
              }
            />
          )}
        >
          <ToastIcon type={toast.type} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <ToastTitle className="line-clamp-1 leading-normal font-medium text-pretty" />
            <ToastDescription className="text-muted-foreground line-clamp-2 leading-[1.4] text-pretty" />
          </div>
          <ToastAction className={buttonVariants({ size: "sm" })} />
          {/* The close stands on the toast's corner, off the line of its words, so a title keeps its whole line. */}
          <ToastClose
            aria-label={t("close-notification")}
            className={cn(
              buttonVariants({ size: "icon-sm", variant: "outline" }),
              "absolute start-0 top-0 size-6 -translate-x-[35%] -translate-y-[35%] rounded-full rtl:translate-x-[35%]"
            )}
          >
            <HugeIcons icon={Cancel01Icon} size="xs" />
          </ToastClose>
        </Toast>
      )}
    </ToastRegion>
  );
}

/**
 * The app's toasts, at the bottom end of the screen and, for the toasts that ask for it, at the bottom or the top
 * center. The copy is a message node from `lib/toast/message`, which renders the reader's language, and a toast
 * shows from `toast` in `lib/toast/notify`, never from here.
 */
export function Toaster() {
  return (
    <>
      <ToastStack place="bottom-end" />
      <ToastStack place="bottom-center" />
      <ToastStack place="top-center" />
    </>
  );
}
