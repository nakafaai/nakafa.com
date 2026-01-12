import type { ReactNode } from "react";

export type BadgeVariant =
  | "default"
  | "default-outline"
  | "secondary"
  | "secondary-outline"
  | "muted"
  | "muted-outline"
  | "destructive"
  | "destructive-outline"
  | "outline";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const BASE_STYLES =
  "inline-flex items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border px-2 py-0.5 font-medium text-xs";

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  default: "border-transparent bg-primary text-primary-foreground",
  "default-outline": "border-border bg-primary text-primary-foreground",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  "secondary-outline": "border-border bg-secondary text-secondary-foreground",
  muted: "border-transparent bg-muted text-muted-foreground",
  "muted-outline": "border-border bg-muted text-muted-foreground",
  destructive: "border-transparent bg-destructive text-destructive-foreground",
  "destructive-outline":
    "border-border bg-destructive text-destructive-foreground",
  outline: "text-foreground",
};

export function Badge({
  children,
  variant = "default",
  className = "",
}: BadgeProps) {
  const combinedClassName =
    `${BASE_STYLES} ${VARIANT_STYLES[variant]} ${className}`.trim();

  return <span className={combinedClassName}>{children}</span>;
}
