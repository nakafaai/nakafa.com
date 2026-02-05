import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";

interface BentoGridProps {
  children: ReactNode;
  className?: string;
}

export function BentoGrid({ children, className }: BentoGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {children}
    </div>
  );
}

interface BentoCardProps {
  children: ReactNode;
  className?: string;
  size?: "default" | "wide" | "tall";
}

export function BentoCard({
  children,
  className,
  size = "default",
}: BentoCardProps) {
  const sizeClasses = {
    default: "",
    wide: "md:col-span-2",
    tall: "row-span-2 md:col-span-2 lg:col-span-1 lg:row-span-2",
  };

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:shadow-sm",
        sizeClasses[size],
        className
      )}
    >
      {children}
    </article>
  );
}

interface BentoVisualProps {
  className?: string;
}

export function BentoVisual({ className }: BentoVisualProps) {
  return <div className={cn("h-32 bg-muted/30 lg:h-40", className)} />;
}

interface BentoContentProps {
  children: ReactNode;
  className?: string;
}

export function BentoContent({ children, className }: BentoContentProps) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

interface BentoStatProps {
  value: string;
  label: string;
}

export function BentoStat({ value, label }: BentoStatProps) {
  return (
    <div className="space-y-0.5">
      <p className="font-semibold text-2xl text-foreground tracking-tight">
        {value}
      </p>
      <p className="font-medium text-foreground text-sm">{label}</p>
    </div>
  );
}

interface BentoFeatureProps {
  title: string;
  description: string;
}

export function BentoFeature({ title, description }: BentoFeatureProps) {
  return (
    <div className="space-y-1.5">
      <h3 className="font-semibold text-foreground text-lg tracking-tight">
        {title}
      </h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
}

interface BentoDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function BentoDescription({
  children,
  className,
}: BentoDescriptionProps) {
  return (
    <p
      className={cn(
        "mt-1.5 text-muted-foreground text-sm leading-relaxed",
        className
      )}
    >
      {children}
    </p>
  );
}
