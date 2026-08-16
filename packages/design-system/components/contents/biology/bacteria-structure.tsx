"use client";

import { BacillusBacteriumModel } from "@repo/design-system/components/contents/biology/bacteria-parts";
import type { BiologySceneProps } from "@repo/design-system/components/contents/biology/data";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import type { ReactNode } from "react";

/** Shows a prokaryotic cell without a nucleus but with nucleoid and ribosomes. */
export function BacterialStructure({
  colors,
  nucleoidDnaLabel,
}: Pick<BiologySceneProps, "colors"> & { nucleoidDnaLabel: ReactNode }) {
  return (
    <group>
      <group rotation={[0, 0, -0.08]}>
        <BacillusBacteriumModel colors={colors} scale={1.18} />
      </group>
      <ThreeLabel
        color={colors.text}
        fontSize="compact"
        position={[0.58, -0.34, 0.72]}
      >
        {nucleoidDnaLabel}
      </ThreeLabel>
    </group>
  );
}
