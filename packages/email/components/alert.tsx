import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { Section, Text } from "react-email";

const alertVariants = cva(
  "relative flex w-full flex-col gap-1 rounded-lg border px-4 py-3 text-sm",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive: "border-destructive bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const alertTitleVariants = cva("min-h-4 font-medium tracking-tight");

const alertDescriptionVariants = cva(
  "text-muted-foreground text-sm leading-relaxed"
);

export type AlertVariant = NonNullable<
  VariantProps<typeof alertVariants>["variant"]
>;

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

export function Alert({
  children,
  variant = "default",
  className = "",
}: AlertProps) {
  return (
    <Section className={alertVariants({ className, variant })} role="alert">
      {children}
    </Section>
  );
}

export function AlertTitle({ children, className = "" }: AlertTitleProps) {
  return <div className={alertTitleVariants({ className })}>{children}</div>;
}

export function AlertDescription({
  children,
  className = "",
}: AlertDescriptionProps) {
  return (
    <Text className={alertDescriptionVariants({ className })}>{children}</Text>
  );
}
