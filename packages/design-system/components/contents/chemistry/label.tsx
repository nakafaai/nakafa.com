import { THREE_DIAGRAM_MINIMUM_FONT_SIZE } from "@repo/design-system/components/three/data/constants";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import type { ReactNode } from "react";

/**
 * The type of a label on apparatus drawn at its real size, in metres: sixteen
 * millimetres tall on the bench, so it is large on a wide frame and falls to
 * the smallest readable size on a narrow one, where the same apparatus is a
 * third as many pixels across and full-size labels would run into each other.
 */
export const BENCH_LABEL = {
  fontSize: 0.016,
  minimumFontSize: THREE_DIAGRAM_MINIMUM_FONT_SIZE,
} as const;

/** The halo around a bench label that sets its own, in metres. */
export const BENCH_LABEL_OUTLINE = 0.0008;

type ParticleLabelPosition = readonly [number, number, number];

export const CHEMISTRY_PARTICLE_LABEL_OUTLINE_WIDTH = 0.01;
const CHEMISTRY_PARTICLE_LABEL_SURFACE_OFFSET_RATIO = 1.05;
export const CHEMISTRY_PARTICLE_LABEL_CLOSE_SURFACE_OFFSET_RATIO = 1.04;

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
      occlude
      outlineColor={outlineColor}
      outlineWidth={outlineWidth}
      position={position}
    >
      {children}
    </ThreeLabel>
  );
}
