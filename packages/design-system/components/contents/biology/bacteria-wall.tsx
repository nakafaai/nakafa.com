"use client";

import { BacterialWallStack } from "@repo/design-system/components/contents/biology/bacteria-wall-stack";
import type { BiologySceneProps } from "@repo/design-system/components/contents/biology/data";
import type { ReactNode } from "react";

/** Compares thick peptidoglycan and outer-membrane wall arrangements. */
export function GramWallComparison({
  colors,
  gramNegativeLabel,
  gramPositiveLabel,
}: Pick<BiologySceneProps, "colors"> & {
  gramNegativeLabel: ReactNode;
  gramPositiveLabel: ReactNode;
}) {
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
