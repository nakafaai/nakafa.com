"use client";

import {
  Alert02Icon,
  InformationCircleIcon,
  SadDizzyIcon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { buttonVariants } from "@repo/design-system/lib/button";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { cn } from "cn";
import { Schema } from "effect";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const ToasterStyleSchema = Schema.Struct({
  "--border-radius": Schema.String,
  "--error-bg": Schema.String,
  "--error-border": Schema.String,
  "--error-text": Schema.String,
  "--gray2": Schema.String,
  "--gray5": Schema.String,
  "--info-bg": Schema.String,
  "--info-border": Schema.String,
  "--info-text": Schema.String,
  "--normal-bg": Schema.String,
  "--normal-bg-hover": Schema.String,
  "--normal-border": Schema.String,
  "--normal-border-hover": Schema.String,
  "--normal-text": Schema.String,
  "--success-bg": Schema.String,
  "--success-border": Schema.String,
  "--success-text": Schema.String,
  "--warning-bg": Schema.String,
  "--warning-border": Schema.String,
  "--warning-text": Schema.String,
});

type ToasterStyle = React.CSSProperties & typeof ToasterStyleSchema.Type;

/**
 * Status toasts reuse the subtle recipe of the `*-outline` buttons: a status
 * border, the popover tinted with 5% of the status color, and popover text.
 */
const toasterStyle: ToasterStyle = {
  "--border-radius": "var(--radius)",
  "--error-bg": "color-mix(in oklch, var(--destructive) 5%, var(--popover))",
  "--error-border": "var(--destructive)",
  "--error-text": "var(--popover-foreground)",
  "--gray2": "var(--accent)",
  "--gray5": "var(--input)",
  "--info-bg": "color-mix(in oklch, var(--info) 5%, var(--popover))",
  "--info-border": "var(--info)",
  "--info-text": "var(--popover-foreground)",
  "--normal-bg": "var(--popover)",
  "--normal-bg-hover": "var(--accent)",
  "--normal-border": "var(--border)",
  "--normal-border-hover": "var(--input)",
  "--normal-text": "var(--popover-foreground)",
  "--success-bg": "color-mix(in oklch, var(--success) 5%, var(--popover))",
  "--success-border": "var(--success)",
  "--success-text": "var(--popover-foreground)",
  "--warning-bg": "color-mix(in oklch, var(--warning) 5%, var(--popover))",
  "--warning-border": "var(--warning)",
  "--warning-text": "var(--popover-foreground)",
};

/**
 * Renders app toasts with the active appearance and subtle status colors.
 *
 * The Toaster is `unstyled`: Sonner's own stylesheet would otherwise set the
 * toast, its buttons, and its close button in unlayered CSS, which beats every
 * Tailwind utility, so the design system recipes would never show. Every part
 * takes its classes here instead. A title takes one line and a description two,
 * which the line clamps enforce whatever the copy says. The copy is a message
 * node from `lib/toast/message`, which renders the reader's language.
 */
function Toaster({ ...props }: ToasterProps) {
  const { resolvedTheme } = useTheme();
  const appearance = getThemeAppearance(resolvedTheme);

  return (
    <Sonner
      className="font-sans!"
      closeButton
      icons={{
        success: <HugeIcons className="size-4" icon={Tick01Icon} />,
        info: <HugeIcons className="size-4" icon={InformationCircleIcon} />,
        warning: <HugeIcons className="size-4" icon={Alert02Icon} />,
        error: <HugeIcons className="size-4" icon={SadDizzyIcon} />,
        loading: <Spinner className="size-4" />,
      }}
      richColors
      style={toasterStyle}
      theme={appearance}
      toastOptions={{
        classNames: {
          actionButton: buttonVariants({ size: "sm" }),
          cancelButton: buttonVariants({ size: "sm", variant: "secondary" }),
          closeButton: cn(
            buttonVariants({ size: "icon-xs", variant: "ghost" }),
            "absolute start-0 top-0 -translate-x-[35%] -translate-y-[35%]"
          ),
          content: "flex min-w-0 flex-1 flex-col gap-0.5",
          description: "line-clamp-2 text-muted-foreground leading-[1.4]",
          icon: "-ms-0.75 me-1 flex size-4 shrink-0 items-center justify-center",
          title: "line-clamp-1 font-medium leading-normal",
          toast:
            "flex w-(--width) items-center gap-1.5 rounded-(--border-radius) border border-border bg-popover p-4 text-[13px] text-popover-foreground shadow-[0_4px_12px_rgba(0,0,0,0.1)] focus-visible:shadow-none! focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-inset",
        },
        unstyled: true,
      }}
      {...props}
    />
  );
}

export { Toaster };
