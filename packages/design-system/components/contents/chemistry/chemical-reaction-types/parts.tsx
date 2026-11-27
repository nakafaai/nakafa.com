import { useChemicalReactionTypeScene } from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/context";
import type { ChemicalReactionTypeScenePoint } from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/data";
import { createBeakerMarkingsTexture } from "@repo/design-system/components/contents/chemistry/glassware";
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
import { createContext, useEffect, useMemo } from "react";
import { Vector2 } from "three";

const BEAKER_RADIUS = 0.36;
const BEAKER_HEIGHT = 1;
const BEAKER_FLOOR_CLEARANCE = 0.032;
const BEAKER_LIQUID_SURFACE_Y = -0.05;
const BEAKER_OPACITY = 0.22;

export const BEAKER_CONTENT_BOTTOM_Y =
  -(BEAKER_HEIGHT / 2) + BEAKER_FLOOR_CLEARANCE;

/** How thick the beaker's wall and its base are drawn. */
const WALL = 0.018;
const BASE = 0.028;

/**
 * A Griffin beaker's wall in section, turned on the lathe: a thick flat
 * base, a rounded heel, a straight wall, a rim that flares and rolls over,
 * and the inner wall back down, so the glass has a real thickness.
 */
const REACTION_BEAKER_PROFILE = Arr.map(
  [
    [0.001, -BEAKER_HEIGHT / 2],
    [BEAKER_RADIUS - 0.04, -BEAKER_HEIGHT / 2],
    [BEAKER_RADIUS - 0.01, -BEAKER_HEIGHT / 2 + 0.01],
    [BEAKER_RADIUS, -BEAKER_HEIGHT / 2 + 0.04],
    [BEAKER_RADIUS, BEAKER_HEIGHT / 2 - 0.05],
    [BEAKER_RADIUS + 0.01, BEAKER_HEIGHT / 2 - 0.02],
    [BEAKER_RADIUS + 0.028, BEAKER_HEIGHT / 2 - 0.003],
    [BEAKER_RADIUS + 0.03, BEAKER_HEIGHT / 2 + 0.005],
    [BEAKER_RADIUS + 0.02, BEAKER_HEIGHT / 2 + 0.008],
    [BEAKER_RADIUS - WALL, BEAKER_HEIGHT / 2 - 0.04],
    [BEAKER_RADIUS - WALL, -BEAKER_HEIGHT / 2 + BASE + 0.025],
    [BEAKER_RADIUS - WALL - 0.025, -BEAKER_HEIGHT / 2 + BASE],
    [0.001, -BEAKER_HEIGHT / 2 + BASE],
  ] as const,
  ([r, y]) => new Vector2(r, y)
);

const LIQUID_RADIUS = BEAKER_RADIUS - WALL - 0.003;

const REACTION_LIQUID_PROFILE = Arr.map(
  [
    [0.001, BEAKER_CONTENT_BOTTOM_Y],
    [LIQUID_RADIUS - 0.025, BEAKER_CONTENT_BOTTOM_Y],
    [LIQUID_RADIUS, BEAKER_CONTENT_BOTTOM_Y + 0.025],
    [LIQUID_RADIUS, BEAKER_LIQUID_SURFACE_Y + 0.026],
    [LIQUID_RADIUS - 0.01, BEAKER_LIQUID_SURFACE_Y + 0.01],
    [LIQUID_RADIUS - 0.035, BEAKER_LIQUID_SURFACE_Y + 0.003],
    [LIQUID_RADIUS - 0.08, BEAKER_LIQUID_SURFACE_Y],
    [0.001, BEAKER_LIQUID_SURFACE_Y],
  ] as const,
  ([r, y]) => new Vector2(r, y)
);

/** A borosilicate Griffin beaker of solution, with a pouring spout and its printed scale, holding `children`. */
export function Beaker({ children }: { children: ReactNode }) {
  const { colors } = useChemicalReactionTypeScene();
  const markings = useMemo(createBeakerMarkingsTexture, []);
  useEffect(() => () => markings?.dispose(), [markings]);

  return (
    <group>
      <mesh castShadow renderOrder={2}>
        <latheGeometry args={[REACTION_BEAKER_PROFILE, 96]} />
        <GlassMaterial color={colors.glass} opacity={BEAKER_OPACITY} />
      </mesh>
      <mesh
        position={[BEAKER_RADIUS + 0.024, BEAKER_HEIGHT / 2 - 0.01, 0]}
        rotation={[0, 0, -0.42]}
        scale={[1.15, 0.6, 0.8]}
      >
        <cylinderGeometry args={[0.04, 0.06, 0.09, 24, 1, true, -1.2, 2.4]} />
        <GlassMaterial color={colors.glass} opacity={0.5} />
      </mesh>
      {markings === null ? null : (
        <mesh position={[0, 0.02, 0]} renderOrder={3} rotation={[0, 2.2, 0]}>
          <cylinderGeometry
            args={[
              BEAKER_RADIUS + 0.003,
              BEAKER_RADIUS + 0.003,
              BEAKER_HEIGHT * 0.78,
              64,
              1,
              true,
            ]}
          />
          <meshBasicMaterial
            depthWrite={false}
            map={markings}
            opacity={0.9}
            transparent
          />
        </mesh>
      )}
      <mesh>
        <latheGeometry args={[REACTION_LIQUID_PROFILE, 64]} />
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
