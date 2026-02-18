import { cn } from "@repo/design-system/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

const bentoCardVariants = cva(
  "group relative flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm",
  {
    variants: {
      size: {
        default: "min-h-96",
        wide: "min-h-80 md:col-span-2",
        tall: "row-span-2 min-h-112 md:col-span-2 lg:col-span-1 lg:row-span-2",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

type BentoGridProps = ComponentProps<"div">;

export function BentoGrid({ className, ...props }: BentoGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3",
        className
      )}
      {...props}
    />
  );
}

interface BentoCardProps
  extends ComponentProps<"article">,
    VariantProps<typeof bentoCardVariants> {}

export function BentoCard({
  className,
  size = "default",
  ...props
}: BentoCardProps) {
  return (
    <article
      className={cn(bentoCardVariants({ size }), className)}
      {...props}
    />
  );
}

type BentoVisualProps = ComponentProps<"div">;

export function BentoVisual({
  className,
  children,
  ...props
}: BentoVisualProps) {
  return (
    <div
      className={cn("absolute inset-0 overflow-hidden", className)}
      {...props}
    >
      {children}
    </div>
  );
}

type BentoContentProps = ComponentProps<"div">;

export function BentoContent({ className, ...props }: BentoContentProps) {
  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 rounded-t-xl border-t bg-card p-5",
        className
      )}
      {...props}
    />
  );
}

interface BentoStatProps {
  label: string;
  value: string;
}

export function BentoStat({ value, label }: BentoStatProps) {
  return (
    <div className="space-y-0.5">
      <p className="font-semibold text-2xl tracking-tight">{value}</p>
      <p className="font-medium">{label}</p>
    </div>
  );
}

interface BentoFeatureProps {
  description: string;
  title: string;
}

export function BentoFeature({ title, description }: BentoFeatureProps) {
  return (
    <div className="space-y-1.5">
      <h3 className="font-semibold text-lg tracking-tight">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
}

type BentoDescriptionProps = ComponentProps<"p">;

export function BentoDescription({
  className,
  ...props
}: BentoDescriptionProps) {
  return (
    <p
      className={cn(
        "mt-1.5 text-muted-foreground text-sm leading-relaxed",
        className
      )}
      {...props}
    />
  );
}
