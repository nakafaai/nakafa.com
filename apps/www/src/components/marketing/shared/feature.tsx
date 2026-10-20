import { Card } from "@repo/design-system/components/ui/card";
import type { ReactNode } from "react";
import { MarketingSection } from "@/components/marketing/shared/section";

/**
 * One feature of a marketing page, read in one glance: its words on the start
 * side and one card of the real product on the end side, the same in every
 * feature, so the page keeps one rhythm. On a phone the words come first.
 */
export function FeatureRow({
  children,
  id,
}: {
  children: ReactNode;
  id: string;
}) {
  return (
    <MarketingSection id={id}>
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        {children}
      </div>
    </MarketingSection>
  );
}

/** The words of a feature: Nina doing what fits it, its title, and one sentence. They rise into place as they scroll in. */
export function FeatureText({ children }: { children: ReactNode }) {
  return (
    <div className="rise-on-scroll grid min-w-0 content-center justify-items-start gap-3">
      {children}
    </div>
  );
}

/** The title of a feature, at the size of every section title. */
export function FeatureTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-balance text-3xl tracking-tight sm:text-4xl">
      {children}
    </h2>
  );
}

/** The one sentence under a feature's title. */
export function FeatureLead({ children }: { children: ReactNode }) {
  return (
    <p className="max-w-md text-pretty text-lg text-muted-foreground">
      {children}
    </p>
  );
}

/**
 * The card of a feature: the real product inside the design system's card, at
 * the card's own spacing, rising into place a little after its words. A feature
 * whose product draws its own cards, such as the lesson window, puts it in
 * `FeatureProduct` instead.
 */
export function FeatureCard({ children }: { children: ReactNode }) {
  return (
    <Card className="rise-on-scroll min-w-0 [--rise-delay:15%]">
      <div className="grid gap-6 px-(--card-spacing)">{children}</div>
    </Card>
  );
}

/** The end side of a feature, for a product that draws its own cards. */
export function FeatureProduct({ children }: { children: ReactNode }) {
  return (
    <div className="rise-on-scroll min-w-0 [--rise-delay:15%]">{children}</div>
  );
}
