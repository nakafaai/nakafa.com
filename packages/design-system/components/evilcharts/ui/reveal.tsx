"use client";

import type { OrderedRevealAnimation } from "@repo/design-system/components/evilcharts/ui/reveal-animation";
import { m } from "motion/react";
import type { ComponentProps, ReactNode } from "react";

const REVEAL_DURATION = 1;

export const REVEAL_EASE: [number, number, number, number] = [0, 0.7, 0.5, 1];

const REVEAL_PROPS = {
  animate: { scaleX: [0, 1] },
  transition: { duration: REVEAL_DURATION, ease: REVEAL_EASE },
};

const SINGLE_REVEAL_ORIGIN: Record<
  Exclude<OrderedRevealAnimation, "edges-in">,
  number
> = {
  "left-to-right": 0,
  "right-to-left": 1,
  "center-out": 0.5,
};

/** Keeps painted geometry together while its reveal is active or static. */
export function RevealGroup({
  animation,
  children,
  ...props
}: Pick<ComponentProps<"g">, "className" | "filter" | "opacity"> & {
  animation: Pick<
    ComponentProps<typeof m.g>,
    "animate" | "style" | "transition"
  > | null;
  children: ReactNode;
}) {
  if (!animation) {
    return <g {...props}>{children}</g>;
  }

  return (
    <m.g {...animation} {...props}>
      {children}
    </m.g>
  );
}

export const RevealMask = ({
  id,
  type,
}: {
  id: string;
  type: OrderedRevealAnimation;
}) => {
  return (
    <mask
      height="100%"
      id={`${id}-reveal-mask`}
      maskContentUnits="userSpaceOnUse"
      maskUnits="userSpaceOnUse"
      width="100%"
      x="0"
      y="0"
    >
      {type === "edges-in" ? (
        <>
          {/* left half wipes inward from the left edge toward the centre */}
          <m.rect
            {...REVEAL_PROPS}
            fill="white"
            height="100%"
            style={{ originX: 0 }}
            width="50%"
            x="0"
            y="0"
          />
          {/* right half wipes inward from the right edge toward the centre */}
          <m.rect
            {...REVEAL_PROPS}
            fill="white"
            height="100%"
            style={{ originX: 1 }}
            width="50%"
            x="50%"
            y="0"
          />
        </>
      ) : (
        <m.rect
          {...REVEAL_PROPS}
          fill="white"
          height="100%"
          style={{ originX: SINGLE_REVEAL_ORIGIN[type] }}
          width="100%"
          x="0"
          y="0"
        />
      )}
    </mask>
  );
};
