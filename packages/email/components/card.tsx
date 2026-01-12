import { Section, Text } from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

interface CardDescriptionProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const CARD_BASE_STYLES =
  "w-full rounded-xl border border-border bg-card text-card-foreground";

const CARD_HEADER_BASE_STYLES = "w-full border-b border-border px-6 py-6";

const CARD_TITLE_BASE_STYLES = "font-medium leading-tight m-0";

const CARD_DESCRIPTION_BASE_STYLES = "text-muted-foreground text-sm m-0";

const CARD_CONTENT_BASE_STYLES = "w-full px-6 py-6";

const CARD_FOOTER_BASE_STYLES = "w-full border-t border-border px-6 py-6";

export function Card({ children, className = "", style }: CardProps) {
  const combinedClassName = `${CARD_BASE_STYLES} ${className}`.trim();

  return (
    <Section className={combinedClassName} style={style}>
      {children}
    </Section>
  );
}

export function CardHeader({
  children,
  className = "",
  style,
}: CardHeaderProps) {
  const combinedClassName = `${CARD_HEADER_BASE_STYLES} ${className}`.trim();

  return (
    <Section className={combinedClassName} style={style}>
      {children}
    </Section>
  );
}

export function CardTitle({ children, className = "", style }: CardTitleProps) {
  const combinedClassName = `${CARD_TITLE_BASE_STYLES} ${className}`.trim();

  return (
    <Text className={combinedClassName} style={style}>
      {children}
    </Text>
  );
}

export function CardDescription({
  children,
  className = "",
  style,
}: CardDescriptionProps) {
  const combinedClassName =
    `${CARD_DESCRIPTION_BASE_STYLES} ${className}`.trim();

  return (
    <Text className={combinedClassName} style={style}>
      {children}
    </Text>
  );
}

export function CardContent({
  children,
  className = "",
  style,
}: CardContentProps) {
  const combinedClassName = `${CARD_CONTENT_BASE_STYLES} ${className}`.trim();

  return (
    <Section className={combinedClassName} style={style}>
      {children}
    </Section>
  );
}

export function CardFooter({
  children,
  className = "",
  style,
}: CardFooterProps) {
  const combinedClassName = `${CARD_FOOTER_BASE_STYLES} ${className}`.trim();

  return (
    <Section className={combinedClassName} style={style}>
      {children}
    </Section>
  );
}
