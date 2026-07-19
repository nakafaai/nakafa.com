"use client";

import { useEffect, useEffectEvent, useState } from "react";

const BAR_REVEAL_DURATION_MS = 500;
const BAR_REVEAL_STAGGER_MS = 50;

type OrderedRevealAnimation =
  | "left-to-right"
  | "right-to-left"
  | "center-out"
  | "edges-in";

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

  switch (animationType) {
    case "right-to-left":
      return lastIndex - index;
    case "center-out":
      return Math.abs(index - center);
    case "edges-in":
      return center - Math.abs(index - center);
    default:
      return index;
  }
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
