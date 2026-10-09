"use client";

import { Match, Schema } from "effect";
import { useEffect, useEffectEvent, useState } from "react";

const BAR_REVEAL_DURATION_MS = 500;
const BAR_REVEAL_STAGGER_MS = 50;

export const RevealAnimationSchema = Schema.Literals([
  "none",
  "left-to-right",
  "right-to-left",
  "center-out",
  "edges-in",
]);

type OrderedRevealAnimation = Exclude<
  typeof RevealAnimationSchema.Type,
  "none"
>;

/**
 * Returns the stagger slot for a data point in an ordered chart reveal.
 */
function getOrderedRevealStep(
  animationType: OrderedRevealAnimation,
  index: number,
  dataLength: number
) {
  const lastIndex = dataLength - 1;
  const center = lastIndex / 2;

  return Match.value(animationType).pipe(
    Match.when("right-to-left", () => lastIndex - index),
    Match.when("center-out", () => Math.abs(index - center)),
    Match.when("edges-in", () => center - Math.abs(index - center)),
    Match.orElse(() => index)
  );
}

/**
 * Returns the full reveal window for a staggered bar series.
 */
function getOrderedRevealDurationMs(
  animationType: OrderedRevealAnimation,
  dataLength: number
) {
  if (dataLength <= 0) {
    return 0;
  }

  const lastStep = Math.max(
    ...Array.from({ length: dataLength }, (_, index) =>
      getOrderedRevealStep(animationType, index, dataLength)
    )
  );

  return BAR_REVEAL_DURATION_MS + lastStep * BAR_REVEAL_STAGGER_MS;
}

/**
 * Enables the initial ordered bar reveal, then renders static final geometry.
 */
function useOrderedReveal(
  animationType: "none" | OrderedRevealAnimation,
  dataLength: number
) {
  const canReveal = animationType !== "none" && dataLength > 0;
  const revealDuration = canReveal
    ? getOrderedRevealDurationMs(animationType, dataLength)
    : 0;
  const getRevealDuration = useEffectEvent(() => revealDuration);
  const [isRevealing, setIsRevealing] = useState(() => canReveal);

  useEffect(() => {
    if (!canReveal) {
      setIsRevealing(false);
      return;
    }

    setIsRevealing(true);
    const timeout = window.setTimeout(
      () => setIsRevealing(false),
      getRevealDuration()
    );

    return () => {
      window.clearTimeout(timeout);
    };
  }, [canReveal]);

  return isRevealing;
}

export {
  BAR_REVEAL_DURATION_MS,
  BAR_REVEAL_STAGGER_MS,
  getOrderedRevealStep,
  type OrderedRevealAnimation,
  useOrderedReveal,
};
