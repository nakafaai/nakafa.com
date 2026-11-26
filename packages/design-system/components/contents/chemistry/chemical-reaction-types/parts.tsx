import { useChemicalReactionTypeScene } from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/context";
import type { ChemicalReactionTypeScenePoint } from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/data";
import {
  CHEMISTRY_PARTICLE_LABEL_CLOSE_SURFACE_OFFSET_RATIO,
  CHEMISTRY_PARTICLE_LABEL_OUTLINE_WIDTH,
  ChemistryParticleLabel,
  getChemistryParticleLabelPosition,
} from "@repo/design-system/components/contents/chemistry/label";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { getThreeParticleLabelFontSize } from "@repo/design-system/components/three/data/constants";
import {
  GlassMaterial,
  LiquidMaterial,
} from "@repo/design-system/components/three/physical";
import { useRequired } from "@repo/design-system/hooks/required";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { createContext } from "react";
import { Vector2 } from "three";

const BEAKER_RADIUS = 0.36;
const BEAKER_HEIGHT = 1;
const BEAKER_FLOOR_CLEARANCE = 0.04;
const BEAKER_LIQUID_SURFACE_Y = -0.05;
const BEAKER_OPACITY = 0.22;

export const BEAKER_CONTENT_BOTTOM_Y =
  -(BEAKER_HEIGHT / 2) + BEAKER_FLOOR_CLEARANCE;

const REACTION_BEAKER_PROFILE = Arr.map(
  [
    [0.001, -BEAKER_HEIGHT / 2],
    [BEAKER_RADIUS * 0.82, -BEAKER_HEIGHT / 2],
    [BEAKER_RADIUS * 0.87, -BEAKER_HEIGHT / 2 + 0.035],
    [BEAKER_RADIUS - 0.01, BEAKER_HEIGHT / 2 - 0.035],
    [BEAKER_RADIUS + 0.02, BEAKER_HEIGHT / 2],
  ] as const,
  ([r, y]) => new Vector2(r, y)
);

const REACTION_LIQUID_PROFILE = Arr.map(
  [
    [0.001, BEAKER_CONTENT_BOTTOM_Y],
    [BEAKER_RADIUS * 0.76, BEAKER_CONTENT_BOTTOM_Y],
    [BEAKER_RADIUS * 0.81, BEAKER_LIQUID_SURFACE_Y + 0.022],
    [BEAKER_RADIUS * 0.74, BEAKER_LIQUID_SURFACE_Y + 0.006],
    [BEAKER_RADIUS * 0.62, BEAKER_LIQUID_SURFACE_Y],
    [0.001, BEAKER_LIQUID_SURFACE_Y],
  ] as const,
  ([r, y]) => new Vector2(r, y)
);

export function Beaker({ children }: { children: ReactNode }) {
  const { colors } = useChemicalReactionTypeScene();
  return (
    <group>
      <mesh castShadow receiveShadow>
        <latheGeometry args={[REACTION_BEAKER_PROFILE, 64]} />
        <GlassMaterial color={colors.glass} opacity={BEAKER_OPACITY} />
      </mesh>
      <mesh position={[0, BEAKER_HEIGHT / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[BEAKER_RADIUS + 0.012, 0.012, 14, 64]} />
        <GlassMaterial color={colors.glass} opacity={0.6} />
      </mesh>
      <mesh>
        <latheGeometry args={[REACTION_LIQUID_PROFILE, 56]} />
        <LiquidMaterial color={colors.liquid} opacity={0.54} />
      </mesh>
      {children}
    </group>
  );
}

/** The element that a group of particles shows: its color, its symbol, and its radius. */
export const ParticleElementContext = createContext<{
  color: string;
  label: string;
  radius: number;
} | null>(null);

export function ParticleCluster({
  color,
  label,
  points,
  radius,
}: {
  color: string;
  label: string;
  points: readonly ChemicalReactionTypeScenePoint[];
  radius: number;
}) {
  return (
    <ParticleElementContext value={{ color, label, radius }}>
      <group>
        {Arr.map(points, (point) => (
          <Particle
            key={Arr.join(Arr.map(point, String), ",")}
            position={point}
          />
        ))}
      </group>
    </ParticleElementContext>
  );
}

export function DiatomicMolecule({
  color,
  label,
  position,
}: {
  color: string;
  label: string;
  position: ChemicalReactionTypeScenePoint;
}) {
  return (
    <ParticleElementContext value={{ color, label, radius: 0.1 }}>
      <group position={position}>
        <Particle position={[-0.07, 0, 0]} />
        <Particle position={[0.07, 0, 0]} />
      </group>
    </ParticleElementContext>
  );
}

/** Draws one particle of the element its context names at a position. */
export function Particle({
  position,
}: {
  position: ChemicalReactionTypeScenePoint;
}) {
  const { colors } = useChemicalReactionTypeScene();
  const element = useRequired(ParticleElementContext, "Particle");
  const { color, label, radius } = element;
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[radius, 36, 24]} />
        <meshPhysicalMaterial
          clearcoat={0.55}
          clearcoatRoughness={0.12}
          color={color}
          roughness={0.26}
        />
      </mesh>
      {label && (
        <ChemistryParticleLabel
          color={colors.sphereText}
          fontSize={getThreeParticleLabelFontSize(radius)}
          outlineColor={colors.sphereTextOutline}
          outlineWidth={CHEMISTRY_PARTICLE_LABEL_OUTLINE_WIDTH}
          position={getChemistryParticleLabelPosition(
            radius,
            CHEMISTRY_PARTICLE_LABEL_CLOSE_SURFACE_OFFSET_RATIO
          )}
        >
          <InlineMath math={`\\mathrm{${label}}`} />
        </ChemistryParticleLabel>
      )}
    </group>
  );
}
