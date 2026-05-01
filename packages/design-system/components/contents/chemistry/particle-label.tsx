import { Billboard, Text } from "@react-three/drei";
import {
  getThreeParticleLabelFontSize,
  MONO_FONT_PATH,
} from "@repo/design-system/components/three/data/constants";

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
  children: string;
  color: string;
  fontSize: number;
  outlineColor?: string;
  outlineWidth?: number;
  position: ParticleLabelPosition;
}) {
  return (
    <Billboard>
      <Text
        anchorX="center"
        anchorY="middle"
        color={color}
        font={MONO_FONT_PATH}
        fontSize={fontSize}
        outlineColor={outlineColor}
        outlineWidth={outlineWidth}
        position={position}
      >
        {children}
        <meshBasicMaterial color={color} toneMapped={false} />
      </Text>
    </Billboard>
  );
}
