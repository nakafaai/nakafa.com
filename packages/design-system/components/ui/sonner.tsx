"use client";

import {
  Alert02Icon,
  InformationCircleIcon,
  SadDizzyIcon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      className="toaster group"
      closeButton
      icons={{
        success: (
          <HugeIcons className="size-4 text-primary" icon={Tick01Icon} />
        ),
        info: (
          <HugeIcons
            className="size-4 text-muted"
            icon={InformationCircleIcon}
          />
        ),
        warning: (
          <HugeIcons className="size-4 text-secondary" icon={Alert02Icon} />
        ),
        error: (
          <HugeIcons className="size-4 text-destructive" icon={SadDizzyIcon} />
        ),
        loading: <Spinner className="size-4 text-foreground" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      theme={theme as ToasterProps["theme"]}
      toastOptions={{
        classNames: {
          description: "text-muted-foreground!",
          closeButton:
            "bg-popover! text-popover-foreground! hover:border-border! transition-colors! ease-out! hover:bg-accent! hover:text-accent-foreground!",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
