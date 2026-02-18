import { Button as ButtonType } from "@react-email/components";
import type { ReactNode } from "react";

export type ButtonVariant =
  | "default"
  | "default-outline"
  | "destructive"
  | "destructive-outline"
  | "outline"
  | "secondary"
  | "secondary-outline"
  | "ghost"
  | "link";

export type ButtonSize = "default" | "sm" | "lg";

interface ButtonProps {
  children: ReactNode;
  className?: string;
  href?: string;
  size?: ButtonSize;
  target?: string;
  variant?: ButtonVariant;
}

const BASE_STYLES =
  "text-center whitespace-nowrap rounded-md font-medium text-sm outline-none";

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground",
  "default-outline": "border border-primary bg-primary/5 text-primary",
  destructive: "bg-destructive text-destructive-foreground",
  "destructive-outline":
    "border border-destructive bg-destructive/5 text-destructive",
  outline: "border border-border bg-background",
  secondary: "bg-secondary text-secondary-foreground",
  "secondary-outline": "border border-secondary bg-secondary/5 text-secondary",
  ghost: "",
  link: "text-primary underline-offset-4 underline",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  default: "px-4 py-2",
  sm: "px-3 py-1.5 text-xs",
  lg: "px-8 py-3",
};

export function Button({
  children,
  variant = "default",
  size = "default",
  className = "",
  href,
  target = "_blank",
}: ButtonProps) {
  const combinedClassName =
    `${BASE_STYLES} ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${className}`.trim();

  if (href) {
    return (
      <ButtonType
        className={combinedClassName}
        href={href}
        rel="noopener noreferrer"
        target={target}
      >
        {children}
      </ButtonType>
    );
  }

  return <ButtonType className={combinedClassName}>{children}</ButtonType>;
}
