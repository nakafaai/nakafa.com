"use client";

import { BacterialWallStack } from "@repo/design-system/components/contents/biology/bacteria-wall-stack";
import { useBiologyColors } from "@repo/design-system/components/contents/biology/context";
import type { ReactNode } from "react";

/** Compares thick peptidoglycan and outer-membrane wall arrangements. */
export function GramWallComparison({
  gramNegativeLabel,
  gramPositiveLabel,
}: {
  gramNegativeLabel?: ReactNode;
  gramPositiveLabel?: ReactNode;
}) {
  const colors = useBiologyColors();

  return (
    <group position={[0, 0.32, 0]}>
      <BacterialWallStack
        colors={[colors.microbe, colors.plant]}
        label={gramPositiveLabel}
        textColor={colors.text}
        x={-0.7}
      />
      <BacterialWallStack
        colors={[colors.membrane, colors.microbe, colors.pathogen]}
        label={gramNegativeLabel}
        textColor={colors.text}
        x={0.72}
      />
    </group>
  );
}
