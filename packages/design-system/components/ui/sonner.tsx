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

const toasterStyle: ToasterStyle = {
  "--border-radius": "var(--radius)",
  "--error-bg": "var(--destructive)",
  "--error-border":
    "color-mix(in oklch, var(--destructive-foreground) 20%, var(--destructive))",
  "--error-text": "var(--destructive-foreground)",
  "--gray2": "var(--accent)",
  "--gray4": "var(--input)",
  "--gray5": "var(--input)",
  "--gray12": "var(--popover-foreground)",
  "--info-bg": "var(--info)",
  "--info-border":
    "color-mix(in oklch, var(--info-foreground) 20%, var(--info))",
  "--info-text": "var(--info-foreground)",
  "--normal-bg": "var(--popover)",
  "--normal-bg-hover": "var(--accent)",
  "--normal-border": "var(--border)",
  "--normal-border-hover": "var(--input)",
  "--normal-text": "var(--popover-foreground)",
  "--success-bg": "var(--success)",
  "--success-border":
    "color-mix(in oklch, var(--success-foreground) 20%, var(--success))",
  "--success-text": "var(--success-foreground)",
  "--warning-bg": "var(--warning)",
  "--warning-border":
    "color-mix(in oklch, var(--warning-foreground) 20%, var(--warning))",
  "--warning-text": "var(--warning-foreground)",
};

/** Renders app toasts with the active appearance and semantic status colors. */
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme();
  const appearance = getThemeAppearance(resolvedTheme);

  return (
    <Sonner
      className="toaster group"
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
            "transition-colors! ease-out! hover:border-current! hover:bg-accent! hover:text-accent-foreground! focus-visible:shadow-none! focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-inset group-data-[type=success]/toast:hover:bg-success! group-data-[type=success]/toast:hover:text-success-foreground! group-data-[type=info]/toast:hover:bg-info! group-data-[type=info]/toast:hover:text-info-foreground! group-data-[type=warning]/toast:hover:bg-warning! group-data-[type=warning]/toast:hover:text-warning-foreground! group-data-[type=error]/toast:hover:bg-destructive! group-data-[type=error]/toast:hover:text-destructive-foreground!",
          description:
            "text-muted-foreground! group-data-[type=success]/toast:text-success-foreground! group-data-[type=info]/toast:text-info-foreground! group-data-[type=warning]/toast:text-warning-foreground! group-data-[type=error]/toast:text-destructive-foreground!",
          toast:
            "group/toast focus-visible:shadow-none! focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-inset",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
