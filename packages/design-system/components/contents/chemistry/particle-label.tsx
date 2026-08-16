import { getThreeParticleLabelFontSize } from "@repo/design-system/components/three/data/constants";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import type { ReactNode } from "react";

type ParticleLabelPosition = readonly [number, number, number];

export const CHEMISTRY_PARTICLE_LABEL_OUTLINE_WIDTH = 0.01;
export const CHEMISTRY_PARTICLE_LABEL_SURFACE_OFFSET_RATIO = 1.05;
export const CHEMISTRY_PARTICLE_LABEL_CLOSE_SURFACE_OFFSET_RATIO = 1.04;

export function getChemistryParticleLabelFontSize(radius: number) {
  return getThreeParticleLabelFontSize(radius);
}

export function getChemistryParticleLabelPosition(
  radius: number,
  offsetRatio = CHEMISTRY_PARTICLE_LABEL_SURFACE_OFFSET_RATIO
) {
  return [0, 0, radius * offsetRatio] as const;
}

/**
 * Keeps particle labels camera-facing while still respecting nearby scene depth.
 */
export function ChemistryParticleLabel({
  children,
  color,
  fontSize,
  outlineColor,
  outlineWidth,
  position,
}: {
  children: ReactNode;
  color: string;
  fontSize: number;
  outlineColor?: string;
  outlineWidth?: number;
  position: ParticleLabelPosition;
}) {
  return (
    <ThreeLabel
      color={color}
      fontSize={fontSize}
      outlineColor={outlineColor}
      outlineWidth={outlineWidth}
      position={position}
    >
      {children}
    </ThreeLabel>
  );
}
