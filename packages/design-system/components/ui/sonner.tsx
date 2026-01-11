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

function Icon({ className, ...props }: React.ComponentProps<typeof HugeIcons>) {
  return <HugeIcons className="size-4" {...props} />;
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      className="toaster group"
      closeButton
      icons={{
        success: <Icon icon={Tick01Icon} />,
        info: <Icon icon={InformationCircleIcon} />,
        warning: <Icon icon={Alert02Icon} />,
        error: <Icon icon={SadDizzyIcon} />,
        loading: <Spinner className="size-4" />,
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
          title: "line-clamp-1",
          description: "text-muted-foreground! line-clamp-2",
          closeButton:
            "bg-popover! text-popover-foreground! hover:border-border! transition-colors! ease-out! hover:bg-accent! hover:text-accent-foreground!",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
