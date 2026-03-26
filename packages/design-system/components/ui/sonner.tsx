"use client";

import {
  Alert02Icon,
  InformationCircleIcon,
  SadDizzyIcon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { cn } from "@repo/design-system/lib/utils";
import { cva } from "class-variance-authority";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

function Icon({ className, ...props }: React.ComponentProps<typeof HugeIcons>) {
  return <HugeIcons className={cn("size-4", className)} {...props} />;
}

type ToastIconTone = "success" | "info" | "warning" | "error" | "loading";

const toastIconWrapper = cva(
  "mr-2 flex size-6 items-center justify-center rounded-full",
  {
    variants: {
      tone: {
        success: "bg-primary/10 text-primary",
        info: "bg-muted/20 text-muted",
        warning: "bg-secondary/10 text-secondary",
        error: "bg-destructive/10 text-destructive",
        loading: "bg-foreground/10 text-foreground",
      },
    },
  }
);

const toastIcon = cva("", {
  variants: {
    tone: {
      success: "text-primary",
      info: "text-muted",
      warning: "text-secondary",
      error: "text-destructive",
      loading: "text-foreground",
    },
  },
});

function IconWithBackground({
  tone,
  className,
  children,
  ...props
}: {
  children: React.ReactNode;
  tone: ToastIconTone;
} & React.ComponentProps<"div">) {
  return (
    <div className={cn(toastIconWrapper({ tone }), className)} {...props}>
      {children}
    </div>
  );
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      className="toaster group"
      closeButton
      icons={{
        success: (
          <IconWithBackground tone="success">
            <Icon
              className={toastIcon({ tone: "success" })}
              icon={Tick01Icon}
            />
          </IconWithBackground>
        ),
        info: (
          <IconWithBackground tone="info">
            <Icon
              className={toastIcon({ tone: "info" })}
              icon={InformationCircleIcon}
            />
          </IconWithBackground>
        ),
        warning: (
          <IconWithBackground tone="warning">
            <Icon
              className={toastIcon({ tone: "warning" })}
              icon={Alert02Icon}
            />
          </IconWithBackground>
        ),
        error: (
          <IconWithBackground tone="error">
            <Icon
              className={toastIcon({ tone: "error" })}
              icon={SadDizzyIcon}
            />
          </IconWithBackground>
        ),
        loading: (
          <IconWithBackground tone="loading">
            <Spinner className={cn("size-4", toastIcon({ tone: "loading" }))} />
          </IconWithBackground>
        ),
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
