import { Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

export type AlertVariant = "default" | "destructive";

interface AlertProps {
  children: ReactNode;
  className?: string;
  variant?: AlertVariant;
}

interface AlertTitleProps {
  children: ReactNode;
  className?: string;
}

interface AlertDescriptionProps {
  children: ReactNode;
  className?: string;
}

const ALERT_BASE_STYLES =
  "relative flex flex-col gap-1 w-full rounded-lg border px-4 py-3 text-sm";

const VARIANT_STYLES: Record<AlertVariant, string> = {
  default: "bg-card text-card-foreground",
  destructive: "bg-destructive/10 text-destructive border-destructive",
};

const ALERT_TITLE_BASE_STYLES = "font-medium tracking-tight min-h-4";

const ALERT_DESCRIPTION_BASE_STYLES =
  "text-muted-foreground text-sm leading-relaxed";

export function Alert({
  children,
  variant = "default",
  className = "",
}: AlertProps) {
  const combinedClassName =
    `${ALERT_BASE_STYLES} ${VARIANT_STYLES[variant]} ${className}`.trim();

  return (
    <Section className={combinedClassName} role="alert">
      {children}
    </Section>
  );
}

export function AlertTitle({ children, className = "" }: AlertTitleProps) {
  const combinedClassName = `${ALERT_TITLE_BASE_STYLES} ${className}`.trim();

  return <div className={combinedClassName}>{children}</div>;
}

export function AlertDescription({
  children,
  className = "",
}: AlertDescriptionProps) {
  const combinedClassName =
    `${ALERT_DESCRIPTION_BASE_STYLES} ${className}`.trim();

  return <Text className={combinedClassName}>{children}</Text>;
}
