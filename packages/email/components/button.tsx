import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { Button as ButtonType } from "react-email";

const buttonVariants = cva(
  "whitespace-nowrap rounded-md text-center text-sm outline-none",
  {
    variants: {
      size: {
        default: "px-4 py-2",
        lg: "px-8 py-3",
        sm: "px-3 py-1.5 text-xs",
      },
      variant: {
        default: "bg-primary text-primary-foreground",
        "default-outline": "border border-primary bg-primary/5 text-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        "destructive-outline":
          "border border-destructive bg-destructive/5 text-foreground",
        ghost: "",
        link: "text-primary underline underline-offset-4",
        outline: "border border-border bg-background",
        secondary: "bg-secondary text-secondary-foreground",
        "secondary-outline":
          "border border-muted-foreground bg-secondary/5 text-foreground",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  }
);

export type ButtonVariant = NonNullable<
  VariantProps<typeof buttonVariants>["variant"]
>;

export type ButtonSize = NonNullable<
  VariantProps<typeof buttonVariants>["size"]
>;

interface ButtonProps {
  children: ReactNode;
  className?: string;
  href?: string;
  size?: ButtonSize;
  target?: string;
  variant?: ButtonVariant;
}

export function Button({
  children,
  variant = "default",
  size = "default",
  className = "",
  href,
  target = "_blank",
}: ButtonProps) {
  if (href) {
    return (
      <ButtonType
        className={buttonVariants({ className, size, variant })}
        href={href}
        rel="noopener noreferrer"
        target={target}
      >
        {children}
      </ButtonType>
    );
  }

  return (
    <ButtonType className={buttonVariants({ className, size, variant })}>
      {children}
    </ButtonType>
  );
}
