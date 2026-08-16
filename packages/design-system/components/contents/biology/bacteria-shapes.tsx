"use client";

import {
  BacillusBacteriumModel,
  CoccusClusterModel,
  SpirillumBacteriumModel,
} from "@repo/design-system/components/contents/biology/bacteria-parts";
import type { BiologySceneProps } from "@repo/design-system/components/contents/biology/data";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import type { ReactNode } from "react";

/** Shows coccus, bacillus, and spiral bacterial forms together. */
export function BacterialShapes({
  bacillusLabel,
  colors,
  coccusLabel,
  spiralLabel,
}: Pick<BiologySceneProps, "colors"> & {
  bacillusLabel: ReactNode;
  coccusLabel: ReactNode;
  spiralLabel: ReactNode;
}) {
  return (
    <group scale={1.22}>
      <group position={[-0.92, 0.34, 0]}>
        <CoccusClusterModel colors={colors} scale={0.96} />
        <ThreeLabel
          color={colors.text}
          fontSize="compact"
          position={[0, -0.42, 0.24]}
        >
          {coccusLabel}
        </ThreeLabel>
      </group>
      <group position={[0.18, 0.32, 0]} rotation={[0.1, 0, -0.18]}>
        <BacillusBacteriumModel
          colors={colors}
          scale={0.78}
          showInterior={false}
          showPili={false}
        />
        <ThreeLabel
          color={colors.text}
          fontSize="compact"
          position={[0, -0.52, 0.28]}
        >
          {bacillusLabel}
        </ThreeLabel>
      </group>
      <group position={[0.92, -0.42, 0]} rotation={[0, 0, -0.18]}>
        <SpirillumBacteriumModel colors={colors} scale={1.02} />
        <ThreeLabel
          color={colors.text}
          fontSize="compact"
          position={[0, -0.36, 0.26]}
        >
          {spiralLabel}
        </ThreeLabel>
      </group>
    </group>
  );
}
