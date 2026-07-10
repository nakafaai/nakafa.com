import type { IconSvgElement } from "@hugeicons/react";
import { GradientBlock } from "@repo/design-system/components/ui/gradient-block";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { ReactNode } from "react";

/** Renders full-color generated artwork behind composed choice-card content. */
export function ChoiceCardVisual({
  children,
  seed,
}: {
  children: ReactNode;
  seed: string;
}) {
  return (
    <div className="relative flex aspect-video w-full items-center justify-center">
      <GradientBlock
        className="pointer-events-none absolute inset-0"
        colorScheme="vibrant"
        intensity="medium"
        keyString={seed}
      />
      {children}
    </div>
  );
}

/** Renders an accessible-contrast decorative icon over choice-card artwork. */
export function ChoiceCardIcon({ icon }: { icon: IconSvgElement }) {
  return (
    <HugeIcons
      aria-hidden
      className="relative size-6 text-background drop-shadow-md"
      icon={icon}
    />
  );
}
