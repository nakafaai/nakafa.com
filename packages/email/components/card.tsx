import { Section, Text } from "@react-email/components";
import { cva } from "class-variance-authority";
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

const cardVariants = cva(
  "w-full rounded-xl border border-border bg-card text-card-foreground"
);

const cardHeaderVariants = cva("w-full border-border border-b px-6 py-6");

const cardTitleVariants = cva("m-0 font-medium leading-tight");

const cardDescriptionVariants = cva("m-0 text-muted-foreground text-sm");

const cardContentVariants = cva("w-full px-6 py-6");

const cardFooterVariants = cva("w-full border-border border-t px-6 py-6");

export function Card({ children, className = "", style }: CardProps) {
  return (
    <Section className={cardVariants({ className })} style={style}>
      {children}
    </Section>
  );
}

export function CardHeader({
  children,
  className = "",
  style,
}: CardHeaderProps) {
  return (
    <Section className={cardHeaderVariants({ className })} style={style}>
      {children}
    </Section>
  );
}

export function CardTitle({ children, className = "", style }: CardTitleProps) {
  return (
    <Text className={cardTitleVariants({ className })} style={style}>
      {children}
    </Text>
  );
}

export function CardDescription({
  children,
  className = "",
  style,
}: CardDescriptionProps) {
  return (
    <Text className={cardDescriptionVariants({ className })} style={style}>
      {children}
    </Text>
  );
}

export function CardContent({
  children,
  className = "",
  style,
}: CardContentProps) {
  return (
    <Section className={cardContentVariants({ className })} style={style}>
      {children}
    </Section>
  );
}

export function CardFooter({
  children,
  className = "",
  style,
}: CardFooterProps) {
  return (
    <Section className={cardFooterVariants({ className })} style={style}>
      {children}
    </Section>
  );
}
