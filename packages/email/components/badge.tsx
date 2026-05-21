import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border px-2 py-0.5 font-medium text-xs",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        "default-outline": "border-border bg-primary text-primary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        "destructive-outline":
          "border-border bg-destructive text-destructive-foreground",
        muted: "border-transparent bg-muted text-muted-foreground",
        "muted-outline": "border-border bg-muted text-muted-foreground",
        outline: "text-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        "secondary-outline":
          "border-border bg-secondary text-secondary-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export type BadgeVariant = NonNullable<
  VariantProps<typeof badgeVariants>["variant"]
>;

interface BadgeProps {
  children: ReactNode;
  className?: string;
  variant?: BadgeVariant;
}

export function Badge({
  children,
  variant = "default",
  className = "",
}: BadgeProps) {
  return (
    <span className={badgeVariants({ className, variant })}>{children}</span>
  );
}
