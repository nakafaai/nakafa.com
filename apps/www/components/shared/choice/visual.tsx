import type { IconSvgElement } from "@hugeicons/react";
import { GradientBlock } from "@repo/design-system/components/ui/gradient-block";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { ReactNode } from "react";

/** Blends full-color generated artwork into its semantic choice-card surface. */
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
        className="mask-[linear-gradient(to_bottom,black_0%,rgba(0,0,0,0.992)_20%,rgba(0,0,0,0.936)_40%,rgba(0,0,0,0.784)_60%,rgba(0,0,0,0.578)_75%,rgba(0,0,0,0.271)_90%,transparent_100%)] mask-no-repeat mask-size-[100%_100%] pointer-events-none absolute inset-0"
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
