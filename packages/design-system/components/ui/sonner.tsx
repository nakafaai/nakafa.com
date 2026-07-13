"use client";

import {
  Alert02Icon,
  InformationCircleIcon,
  SadDizzyIcon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { getThemeAppearance } from "@repo/design-system/lib/theme";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

interface ToasterStyle extends React.CSSProperties {
  "--border-radius": string;
  "--error-bg": string;
  "--error-border": string;
  "--error-text": string;
  "--info-bg": string;
  "--info-border": string;
  "--info-text": string;
  "--normal-bg": string;
  "--normal-border": string;
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
  "--error-border": "var(--destructive)",
  "--error-text": "var(--destructive-foreground)",
  "--info-bg": "var(--info)",
  "--info-border": "var(--info)",
  "--info-text": "var(--info-foreground)",
  "--normal-bg": "var(--popover)",
  "--normal-border": "var(--border)",
  "--normal-text": "var(--popover-foreground)",
  "--success-bg": "var(--success)",
  "--success-border": "var(--success)",
  "--success-text": "var(--success-foreground)",
  "--warning-bg": "var(--warning)",
  "--warning-border": "var(--warning)",
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
      {...props}
    />
  );
};

export { Toaster };
