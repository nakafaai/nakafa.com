"use client";

import {
  Alert02Icon,
  InformationCircleIcon,
  SadDizzyIcon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

interface ToasterStyle extends React.CSSProperties {
  "--border-radius": string;
  "--error-bg": string;
  "--error-border": string;
  "--error-text": string;
  "--gray2": string;
  "--gray4": string;
  "--gray5": string;
  "--gray12": string;
  "--info-bg": string;
  "--info-border": string;
  "--info-text": string;
  "--normal-bg": string;
  "--normal-bg-hover": string;
  "--normal-border": string;
  "--normal-border-hover": string;
  "--normal-text": string;
  "--success-bg": string;
  "--success-border": string;
  "--success-text": string;
  "--warning-bg": string;
  "--warning-border": string;
  "--warning-text": string;
}

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
  "--gray4": "var(--input)",
  "--gray5": "var(--input)",
  "--gray12": "var(--popover-foreground)",
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

/** Renders app toasts with the active appearance and subtle status colors. */
function Toaster({ ...props }: ToasterProps) {
  const { resolvedTheme } = useTheme();
  const appearance = getThemeAppearance(resolvedTheme);

  return (
    <Sonner
      className="toaster group font-sans!"
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
          actionButton:
            "focus-visible:shadow-none! focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-inset",
          cancelButton:
            "bg-secondary! text-secondary-foreground! focus-visible:shadow-none! focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-inset",
          closeButton:
            "transition-colors! ease-out! hover:border-current! hover:bg-accent! hover:text-accent-foreground! focus-visible:shadow-none! focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-inset",
          description: "text-muted-foreground!",
          toast:
            "focus-visible:shadow-none! focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-inset",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
