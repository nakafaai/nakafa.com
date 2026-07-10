import type { IconSvgElement } from "@hugeicons/react";
import { GradientBlock } from "@repo/design-system/components/ui/gradient-block";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { ReactNode } from "react";

/** Renders the vivid gradient artwork shared by try-out discovery cards. */
export function TryoutCardVisual({
  children,
  keyString,
}: {
  children: ReactNode;
  keyString: string;
}) {
  return (
    <div className="relative flex aspect-video w-full items-center justify-center">
      <GradientBlock
        className="mask-[linear-gradient(to_bottom,black_0%,black_65%,transparent_100%)] mask-no-repeat mask-size-[100%_100%] pointer-events-none absolute inset-0"
        colorScheme="vibrant"
        intensity="medium"
        keyString={keyString}
      />
      {children}
    </div>
  );
}

/** Renders a theme-contrasting icon over vivid try-out card artwork. */
export function TryoutCardIcon({ icon }: { icon: IconSvgElement }) {
  return (
    <HugeIcons
      aria-hidden
      className="relative size-6 text-background drop-shadow-md"
      icon={icon}
    />
  );
}
