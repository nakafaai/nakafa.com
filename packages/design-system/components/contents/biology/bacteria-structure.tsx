import { BacillusBacteriumModel } from "@repo/design-system/components/contents/biology/bacteria-parts";
import { useBiologyColors } from "@repo/design-system/components/contents/biology/context";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import type { ReactNode } from "react";

/** Shows a prokaryotic cell without a nucleus but with nucleoid and ribosomes. */
export function BacterialStructure({
  nucleoidDnaLabel,
}: {
  nucleoidDnaLabel?: ReactNode;
}) {
  const colors = useBiologyColors();

  return (
    <group>
      <group rotation={[0, 0, -0.08]}>
        <BacillusBacteriumModel colors={colors} scale={1.18} />
      </group>
      {nucleoidDnaLabel === undefined ? null : (
        <ThreeLabel
          color={colors.text}
          fontSize="compact"
          position={[0.58, -0.34, 0.72]}
        >
          {nucleoidDnaLabel}
        </ThreeLabel>
      )}
    </group>
  );
}
