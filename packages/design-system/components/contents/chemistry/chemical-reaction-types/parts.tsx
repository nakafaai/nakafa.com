import { Billboard, Text } from "@react-three/drei";
import type {
  ChemicalReactionTypeSceneColors,
  ChemicalReactionTypeScenePoint,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/data";
import {
  getThreeParticleLabelFontSize,
  MONO_FONT_PATH,
} from "@repo/design-system/components/three/data/constants";
import type { ReactNode } from "react";
import { DoubleSide } from "three";

const PARTICLE_LABEL_SURFACE_OFFSET_RATIO = 1.04;
const LABEL_OUTLINE_WIDTH = 0.01;
const BEAKER_RADIUS = 0.36;
const BEAKER_HEIGHT = 1;
const BEAKER_LIQUID_HEIGHT = 0.46;
const BEAKER_LIQUID_Y = -0.28;
const BEAKER_OPACITY = 0.18;

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
        <ParticleLabel
          color={labelColor}
          fontSize={getThreeParticleLabelFontSize(radius)}
          outlineColor={labelOutlineColor}
          radius={radius}
        >
          {label}
        </ParticleLabel>
      )}
    </group>
  );
}

function ParticleLabel({
  children,
  color,
  fontSize,
  outlineColor,
  radius,
}: {
  children: string;
  color: string;
  fontSize: number;
  outlineColor: string;
  radius: number;
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
        outlineWidth={LABEL_OUTLINE_WIDTH}
        position={[0, 0, radius * PARTICLE_LABEL_SURFACE_OFFSET_RATIO]}
        renderOrder={10}
      >
        {children}
        <meshBasicMaterial color={color} depthTest={false} toneMapped={false} />
      </Text>
    </Billboard>
  );
}
