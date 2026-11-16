import { BacterialWallStack } from "@repo/design-system/components/contents/biology/bacteria/stack";
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
    <group position={[0, 0.2, 0]} scale={1.55}>
      <BacterialWallStack
        gram="positive"
        label={gramPositiveLabel}
        textColor={colors.text}
        x={-0.66}
      />
      <BacterialWallStack
        gram="negative"
        label={gramNegativeLabel}
        textColor={colors.text}
        x={0.66}
      />
    </group>
  );
}
