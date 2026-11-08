import { Card } from "@repo/design-system/components/ui/card";
import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { MarketingSection } from "@/components/marketing/shared/section";

/**
 * How a feature lays out its words and its product, so a page can vary its rhythm as the home does:
 * `start` puts the words on the start side, `end` puts them on the end side, `stack` puts them
 * centred above the product, which takes the column's middle, and `wide` does the same over a product
 * as wide as the page. On a phone the words always come first.
 */
const featureVariants = cva("group/feature mx-auto grid w-full gap-12", {
  defaultVariants: { layout: "start" },
  variants: {
    layout: {
      end: "max-w-7xl items-center lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16 lg:*:first:order-last",
      stack: "max-w-3xl",
      wide: "max-w-6xl",
      start:
        "max-w-7xl items-center lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16",
    },
  },
});

/**
 * One feature of a marketing page, read in one glance: its words and one card of the real product,
 * on either side or the words above it (`layout`). On a phone the words come first.
 */
export function FeatureRow({
  children,
  layout,
  ...section
}: {
  children: ReactNode;
  id: string;
} & VariantProps<typeof featureVariants>) {
  return (
    <MarketingSection {...section}>
      <div
        className={featureVariants({ layout })}
        data-centred={layout === "stack" || layout === "wide" ? "" : undefined}
      >
        {children}
      </div>
    </MarketingSection>
  );
}

/**
 * The words of a feature: Nina doing what fits it, its title, and one sentence. They rise into place
 * as they scroll in, and centre themselves above a stacked feature's product.
 */
export function FeatureText({ children }: { children: ReactNode }) {
  return (
    <div className="rise-on-scroll grid min-w-0 content-center justify-items-start gap-3 group-data-centred/feature:justify-items-center group-data-centred/feature:text-center">
      {children}
    </div>
  );
}

/** The title of a feature, at the size of every section title. */
export function FeatureTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-3xl tracking-tight text-balance sm:text-4xl">
      {children}
    </h2>
  );
}

/** The one sentence under a feature's title. */
export function FeatureLead({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground max-w-md text-lg text-pretty">
      {children}
    </p>
  );
}

/**
 * The card of a feature: the real product inside the design system's card, at
 * the card's own spacing, rising into place a little after its words. Its one
 * column holds the card's width, so a row of unbroken text truncates inside
 * the card instead of widening it past its rounded edge. A feature
 * whose product draws its own cards, such as the lesson window, puts it in
 * `FeatureProduct` instead.
 */
export function FeatureCard({ children }: { children: ReactNode }) {
  return (
    <Card className="rise-on-scroll min-w-0 [--rise-delay:15%]">
      <div className="grid grid-cols-1 gap-6 px-(--card-spacing)">
        {children}
      </div>
    </Card>
  );
}

/** The end side of a feature, for a product that draws its own cards. */
export function FeatureProduct({ children }: { children: ReactNode }) {
  return (
    <div className="rise-on-scroll min-w-0 [--rise-delay:15%]">{children}</div>
  );
}
