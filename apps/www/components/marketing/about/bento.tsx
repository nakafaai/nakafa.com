import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

interface BentoSectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

function BentoSection({ children, className, id }: BentoSectionProps) {
  return (
    <section
      className={cn("scroll-mt-28 border-border border-y py-24", className)}
      id={id}
    >
      {children}
    </section>
  );
}

interface BentoGridProps {
  children: ReactNode;
  className?: string;
}

function BentoGrid({ children, className }: BentoGridProps) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-6", className)}>
      {children}
    </div>
  );
}

interface BentoHeaderProps {
  title: string;
  description: string;
}

function BentoHeader({ title, description }: BentoHeaderProps) {
  return (
    <div className="mb-12 text-center">
      <h2 className="font-semibold text-3xl tracking-tight sm:text-4xl">
        {title}
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-balance text-lg text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

interface BentoCardProps {
  children: ReactNode;
  className?: string;
  size?: "default" | "wide" | "tall";
}

function BentoCard({ children, className, size = "default" }: BentoCardProps) {
  const sizeClasses = {
    default: "",
    wide: "md:col-span-2",
    tall: "row-span-2 md:col-span-2 lg:col-span-1",
  };

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:shadow-sm",
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
  aspectRatio?: "square" | "wide" | "tall";
}

function BentoVisual({ className, aspectRatio = "square" }: BentoVisualProps) {
  const aspectClasses = {
    square: "aspect-square",
    wide: "aspect-[2/1]",
    tall: "aspect-[1/2]",
  };

  return (
    <div className={cn("bg-muted", aspectClasses[aspectRatio], className)} />
  );
}

interface BentoContentProps {
  children: ReactNode;
  className?: string;
}

function BentoContent({ children, className }: BentoContentProps) {
  return <div className={cn("p-6", className)}>{children}</div>;
}

interface BentoStatProps {
  value: string;
  label: string;
}

function BentoStat({ value, label }: BentoStatProps) {
  return (
    <div className="space-y-1">
      <p className="font-semibold text-3xl text-foreground tracking-tight">
        {value}
      </p>
      <p className="font-medium text-foreground">{label}</p>
    </div>
  );
}

interface BentoFeatureProps {
  title: string;
  description: string;
}

function BentoFeature({ title, description }: BentoFeatureProps) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-foreground text-xl tracking-tight">
        {title}
      </h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

interface BentoDescriptionProps {
  children: ReactNode;
  className?: string;
}

function BentoDescription({ children, className }: BentoDescriptionProps) {
  return (
    <p className={cn("mt-2 text-muted-foreground text-sm", className)}>
      {children}
    </p>
  );
}

export function Bento() {
  const t = useTranslations("Bento");

  return (
    <BentoSection id="features">
      <BentoGrid>
        <BentoHeader description={t("description")} title={t("title")} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Materials Card - 5,000+ */}
          <BentoCard>
            <BentoVisual />
            <BentoContent>
              <BentoStat label={t("materials-label")} value="5,000+" />
              <BentoDescription>{t("materials-description")}</BentoDescription>
            </BentoContent>
          </BentoCard>

          {/* Exercises Card - 2,000+ */}
          <BentoCard>
            <BentoVisual />
            <BentoContent>
              <BentoStat label={t("exercises-label")} value="2,000+" />
              <BentoDescription>{t("exercises-description")}</BentoDescription>
            </BentoContent>
          </BentoCard>

          {/* AI Card - Tall */}
          <BentoCard size="tall">
            <BentoVisual aspectRatio="tall" className="h-48 md:h-auto" />
            <BentoContent className="flex flex-col justify-center">
              <BentoFeature
                description={t("ai-description")}
                title={t("ai-title")}
              />
            </BentoContent>
          </BentoCard>

          {/* Subjects Card - Wide */}
          <BentoCard size="wide">
            <BentoVisual aspectRatio="wide" />
            <BentoContent>
              <BentoStat label={t("subjects-label")} value="100+" />
              <BentoDescription>{t("subjects-description")}</BentoDescription>
            </BentoContent>
          </BentoCard>

          {/* Performance Card */}
          <BentoCard>
            <BentoVisual />
            <BentoContent>
              <BentoFeature
                description={t("performance-description")}
                title={t("performance-title")}
              />
            </BentoContent>
          </BentoCard>

          {/* Quality Card */}
          <BentoCard>
            <BentoVisual />
            <BentoContent>
              <BentoFeature
                description={t("quality-description")}
                title={t("quality-title")}
              />
            </BentoContent>
          </BentoCard>
        </div>
      </BentoGrid>
    </BentoSection>
  );
}

// Export compound component for advanced use cases
export const BentoCompound = {
  Section: BentoSection,
  Grid: BentoGrid,
  Header: BentoHeader,
  Card: BentoCard,
  Visual: BentoVisual,
  Content: BentoContent,
  Stat: BentoStat,
  Feature: BentoFeature,
  Description: BentoDescription,
};
