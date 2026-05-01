import type {
  ChemicalReactionTypeSceneColors,
  ChemicalReactionTypeScenePoint,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/data";
import {
  CHEMISTRY_PARTICLE_LABEL_CLOSE_SURFACE_OFFSET_RATIO,
  CHEMISTRY_PARTICLE_LABEL_OUTLINE_WIDTH,
  ChemistryParticleLabel,
  getChemistryParticleLabelFontSize,
  getChemistryParticleLabelPosition,
} from "@repo/design-system/components/contents/chemistry/particle-label";
import type { ReactNode } from "react";
import { DoubleSide } from "three";

const BEAKER_RADIUS = 0.36;
const BEAKER_HEIGHT = 1;
const BEAKER_FLOOR_CLEARANCE = 0.04;
const BEAKER_LIQUID_SURFACE_Y = -0.05;
const BEAKER_OPACITY = 0.18;

export const BEAKER_CONTENT_BOTTOM_Y =
  -(BEAKER_HEIGHT / 2) + BEAKER_FLOOR_CLEARANCE;

const BEAKER_LIQUID_HEIGHT = BEAKER_LIQUID_SURFACE_Y - BEAKER_CONTENT_BOTTOM_Y;
const BEAKER_LIQUID_Y = BEAKER_CONTENT_BOTTOM_Y + BEAKER_LIQUID_HEIGHT / 2;

export function Beaker({
  children,
  colors,
}: {
  children: ReactNode;
  colors: ChemicalReactionTypeSceneColors;
}) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <cylinderGeometry
          args={[
            BEAKER_RADIUS,
            BEAKER_RADIUS * 0.86,
            BEAKER_HEIGHT,
            64,
            1,
            true,
          ]}
        />
        <meshStandardMaterial
          color={colors.glass}
          depthWrite={false}
          opacity={BEAKER_OPACITY}
          roughness={0.14}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <mesh position={[0, BEAKER_LIQUID_Y, 0]}>
        <cylinderGeometry
          args={[
            BEAKER_RADIUS * 0.78,
            BEAKER_RADIUS * 0.78,
            BEAKER_LIQUID_HEIGHT,
            48,
          ]}
        />
        <meshStandardMaterial
          color={colors.liquid}
          depthWrite={false}
          opacity={0.48}
          transparent
        />
      </mesh>
      {children}
    </group>
  );
}

export function ParticleCluster({
  color,
  label,
  labelColor,
  labelOutlineColor,
  points,
  radius,
}: {
  color: string;
  label: string;
  labelColor: string;
  labelOutlineColor: string;
  points: readonly ChemicalReactionTypeScenePoint[];
  radius: number;
}) {
  return (
    <group>
      {points.map((point) => (
        <Particle
          color={color}
          key={point.join(",")}
          label={label}
          labelColor={labelColor}
          labelOutlineColor={labelOutlineColor}
          position={point}
          radius={radius}
        />
      ))}
    </group>
  );
}

export function DiatomicMolecule({
  color,
  label,
  labelColor,
  labelOutlineColor,
  position,
}: {
  color: string;
  label: string;
  labelColor: string;
  labelOutlineColor: string;
  position: ChemicalReactionTypeScenePoint;
}) {
  return (
    <group position={position}>
      <Particle
        color={color}
        label={label}
        labelColor={labelColor}
        labelOutlineColor={labelOutlineColor}
        position={[-0.07, 0, 0]}
        radius={0.1}
      />
      <Particle
        color={color}
        label={label}
        labelColor={labelColor}
        labelOutlineColor={labelOutlineColor}
        position={[0.07, 0, 0]}
        radius={0.1}
      />
    </group>
  );
}

export function Particle({
  color,
  label,
  labelColor,
  labelOutlineColor,
  position,
  radius,
}: {
  color: string;
  label: string;
  labelColor: string;
  labelOutlineColor: string;
  position: ChemicalReactionTypeScenePoint;
  radius: number;
}) {
  return (
    <group position={position}>
      <mesh castShadow>
        <sphereGeometry args={[radius, 32, 20]} />
        <meshStandardMaterial color={color} roughness={0.34} />
      </mesh>
      {label && (
        <ChemistryParticleLabel
          color={labelColor}
          fontSize={getChemistryParticleLabelFontSize(radius)}
          outlineColor={labelOutlineColor}
          outlineWidth={CHEMISTRY_PARTICLE_LABEL_OUTLINE_WIDTH}
          position={getChemistryParticleLabelPosition(
            radius,
            CHEMISTRY_PARTICLE_LABEL_CLOSE_SURFACE_OFFSET_RATIO
          )}
        >
          {label}
        </ChemistryParticleLabel>
      )}
    </group>
  );
}
