import { useFrame } from "@react-three/fiber";
import {
  COLOR_CUE_ID,
  ENERGY_CUE_ID,
  GAS_CUE_ID,
  PRECIPITATE_CUE_ID,
  type ReactionCharacteristicsLabLabels,
  type ReactionCueId,
  type ReactionSceneColors,
  type ReactionScenePoint,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-characteristics/data";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";
import { ArrowHelper } from "@repo/design-system/components/three/arrow-helper";
import { THREE_FONT_SIZE } from "@repo/design-system/components/three/data/constants";
import { useRef } from "react";
import { DoubleSide, type Group, type Mesh } from "three";

const BEFORE_BEAKER_X = -1.08;
const AFTER_BEAKER_X = 1.08;
const BEAKER_SCALE = 1.08;
const BEAKER_WALL_HEIGHT = 1.34;
const BEAKER_TOP_RADIUS = 0.48;
const BEAKER_BOTTOM_RADIUS = 0.39;
const LIQUID_HEIGHT = 0.66;
const LIQUID_Y = -0.2;
const LIQUID_RADIUS = 0.36;
const GLASS_OPACITY = 0.22;
const LIQUID_OPACITY = 0.66;
const LABEL_Y = 1.3;
const CAPTION_Z = 0.5;
const SCENE_Y = -0.12;
const SCENE_SCALE = 1.2;
const BUBBLE_RADIUS = 0.055;
const SOLID_RADIUS = 0.07;
const COLOR_PARTICLE_RADIUS = 0.055;
const HEAT_MARKER_HEIGHT = 0.38;
const HEAT_MARKER_RADIUS = 0.018;
const HEAT_MARKER_Y = 0.44;

const BUBBLES = [
  {
    id: "bubble-left-low",
    phase: 0.04,
    position: [-0.18, -0.38, 0.08],
    speed: 0.34,
  },
  {
    id: "bubble-center-low",
    phase: 0.18,
    position: [0.02, -0.34, -0.04],
    speed: 0.42,
  },
  {
    id: "bubble-right-low",
    phase: 0.31,
    position: [0.2, -0.32, 0.12],
    speed: 0.38,
  },
  {
    id: "bubble-left-mid",
    phase: 0.46,
    position: [-0.12, -0.16, -0.12],
    speed: 0.36,
  },
  {
    id: "bubble-center-mid",
    phase: 0.62,
    position: [0.08, -0.12, 0.1],
    speed: 0.4,
  },
  {
    id: "bubble-right-mid",
    phase: 0.78,
    position: [0.23, -0.04, -0.06],
    speed: 0.35,
  },
] satisfies ReactionParticle[];

const PRECIPITATE_PARTICLES = [
  { id: "solid-left", position: [-0.24, -0.5, 0.05] },
  { id: "solid-center-left", position: [-0.1, -0.53, -0.08] },
  { id: "solid-center", position: [0.04, -0.49, 0.1] },
  { id: "solid-center-right", position: [0.16, -0.52, -0.02] },
  { id: "solid-right", position: [0.28, -0.5, 0.09] },
] satisfies ReactionParticle[];

const COLOR_PARTICLES = [
  {
    id: "color-left",
    phase: 0.12,
    position: [-0.22, -0.25, 0.12],
    speed: 0.45,
  },
  {
    id: "color-center-left",
    phase: 0.3,
    position: [-0.06, -0.1, -0.1],
    speed: 0.4,
  },
  {
    id: "color-center-right",
    phase: 0.56,
    position: [0.12, -0.22, 0.08],
    speed: 0.42,
  },
  {
    id: "color-right",
    phase: 0.78,
    position: [0.24, -0.03, -0.04],
    speed: 0.36,
  },
] satisfies ReactionParticle[];

const HEAT_MARKERS = [
  { id: "heat-left", position: [-0.21, HEAT_MARKER_Y, 0] },
  { id: "heat-center-left", position: [-0.07, HEAT_MARKER_Y, 0] },
  { id: "heat-center-right", position: [0.07, HEAT_MARKER_Y, 0] },
  { id: "heat-right", position: [0.21, HEAT_MARKER_Y, 0] },
] satisfies ReactionParticle[];

type ReactionPhase = "after" | "before";

interface ReactionParticle {
  id: string;
  phase?: number;
  position: ReactionScenePoint;
  speed?: number;
}

/**
 * Renders a paired 3D beaker scene for the selected reaction clue.
 */
export function ReactionCharacteristicsScene({
  colors,
  cueId,
  labels,
}: {
  colors: ReactionSceneColors;
  cueId: ReactionCueId;
  labels: Pick<ReactionCharacteristicsLabLabels, "after" | "before">;
}) {
  return (
    <group position={[0, SCENE_Y, 0]} scale={SCENE_SCALE}>
      <ReactionBeaker
        colors={colors}
        cueId={cueId}
        phase="before"
        title={labels.before}
        x={BEFORE_BEAKER_X}
      />

      <ArrowHelper
        arrowSize={0.14}
        color={colors.arrow}
        from={[-0.45, 0.08, 0.04]}
        lineWidth={3}
        to={[0.45, 0.08, 0.04]}
      />

      <ReactionBeaker
        colors={colors}
        cueId={cueId}
        phase="after"
        title={labels.after}
        x={AFTER_BEAKER_X}
      />
    </group>
  );
}

/**
 * Renders one 3D beaker state.
 */
function ReactionBeaker({
  colors,
  cueId,
  phase,
  title,
  x,
}: {
  colors: ReactionSceneColors;
  cueId: ReactionCueId;
  phase: ReactionPhase;
  title: string;
  x: number;
}) {
  return (
    <group position={[x, 0, 0]} scale={BEAKER_SCALE}>
      <SceneLabel
        alwaysOnTop
        color={colors.text}
        fontSize={THREE_FONT_SIZE.annotation}
        position={[0, LABEL_Y, CAPTION_Z]}
      >
        {title}
      </SceneLabel>

      <BeakerGlass colors={colors} />
      <Liquid color={getLiquidColor({ colors, cueId, phase })} />
      <ReactionCueVisual colors={colors} cueId={cueId} phase={phase} />
    </group>
  );
}

/**
 * Draws the glass wall, rim, and base without hiding the reaction cue.
 */
function BeakerGlass({ colors }: { colors: ReactionSceneColors }) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <cylinderGeometry
          args={[
            BEAKER_TOP_RADIUS,
            BEAKER_BOTTOM_RADIUS,
            BEAKER_WALL_HEIGHT,
            64,
            1,
            true,
          ]}
        />
        <meshStandardMaterial
          color={colors.glass}
          depthWrite={false}
          opacity={GLASS_OPACITY}
          roughness={0.1}
          side={DoubleSide}
          transparent
        />
      </mesh>

      <mesh
        position={[0, BEAKER_WALL_HEIGHT / 2, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[BEAKER_TOP_RADIUS, 0.018, 16, 72]} />
        <meshStandardMaterial color={colors.glass} opacity={0.58} transparent />
      </mesh>

      <mesh position={[0, -BEAKER_WALL_HEIGHT / 2, 0]}>
        <cylinderGeometry
          args={[BEAKER_BOTTOM_RADIUS, BEAKER_BOTTOM_RADIUS, 0.04, 64]}
        />
        <meshStandardMaterial color={colors.glass} opacity={0.34} transparent />
      </mesh>
    </group>
  );
}

/**
 * Shows the liquid level in the beaker.
 */
function Liquid({ color }: { color: string }) {
  return (
    <mesh position={[0, LIQUID_Y, 0]}>
      <cylinderGeometry
        args={[LIQUID_RADIUS, LIQUID_RADIUS, LIQUID_HEIGHT, 64]}
      />
      <meshStandardMaterial
        color={color}
        depthWrite={false}
        opacity={LIQUID_OPACITY}
        roughness={0.36}
        transparent
      />
    </mesh>
  );
}

/**
 * Chooses the visible 3D cue only after the reaction state.
 */
function ReactionCueVisual({
  colors,
  cueId,
  phase,
}: {
  colors: ReactionSceneColors;
  cueId: ReactionCueId;
  phase: ReactionPhase;
}) {
  if (phase === "before") {
    return null;
  }

  if (cueId === GAS_CUE_ID) {
    return <GasBubbles color={colors.bubble} />;
  }

  if (cueId === PRECIPITATE_CUE_ID) {
    return <Precipitate color={colors.precipitate} />;
  }

  if (cueId === COLOR_CUE_ID) {
    return <ColorParticles color={colors.liquidAfterColor} />;
  }

  if (cueId === ENERGY_CUE_ID) {
    return <HeatMarkers color={colors.heat} />;
  }

  return null;
}

/**
 * Animates gas bubbles rising through the product side.
 */
function GasBubbles({ color }: { color: string }) {
  return (
    <group>
      {BUBBLES.map((bubble) => (
        <AnimatedBubble color={color} key={bubble.id} particle={bubble} />
      ))}
    </group>
  );
}

/**
 * Renders one bubble with looping vertical motion.
 */
function AnimatedBubble({
  color,
  particle,
}: {
  color: string;
  particle: ReactionParticle;
}) {
  const meshRef = useRef<Mesh>(null);
  const [x, y, z] = particle.position;
  const speed = particle.speed ?? 0.35;
  const phase = particle.phase ?? 0;

  useFrame(({ clock }) => {
    if (!meshRef.current) {
      return;
    }

    const progress = (clock.elapsedTime * speed + phase) % 1;
    meshRef.current.position.y = y + progress * 0.58;
    meshRef.current.scale.setScalar(0.82 + progress * 0.32);
  });

  return (
    <mesh position={[x, y, z]} ref={meshRef}>
      <sphereGeometry args={[BUBBLE_RADIUS, 24, 16]} />
      <meshStandardMaterial
        color={color}
        opacity={0.34}
        roughness={0.12}
        transparent
      />
    </mesh>
  );
}

/**
 * Shows insoluble solid particles collecting at the bottom.
 */
function Precipitate({ color }: { color: string }) {
  return (
    <group>
      {PRECIPITATE_PARTICLES.map((particle) => (
        <mesh castShadow key={particle.id} position={particle.position}>
          <sphereGeometry args={[SOLID_RADIUS, 24, 16]} />
          <meshStandardMaterial color={color} roughness={0.46} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Shows the product color as suspended particles inside the liquid.
 */
function ColorParticles({ color }: { color: string }) {
  const groupRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.rotation.y += delta * 0.35;
  });

  return (
    <group ref={groupRef}>
      {COLOR_PARTICLES.map((particle) => (
        <mesh castShadow key={particle.id} position={particle.position}>
          <sphereGeometry args={[COLOR_PARTICLE_RADIUS, 24, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.12}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Shows energy release or absorption as pulsing markers above the liquid.
 */
function HeatMarkers({ color }: { color: string }) {
  const groupRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.scale.y = 0.9 + Math.sin(clock.elapsedTime * 4) * 0.12;
  });

  return (
    <group ref={groupRef}>
      {HEAT_MARKERS.map((marker) => (
        <mesh castShadow key={marker.id} position={marker.position}>
          <cylinderGeometry
            args={[
              HEAT_MARKER_RADIUS,
              HEAT_MARKER_RADIUS,
              HEAT_MARKER_HEIGHT,
              18,
            ]}
          />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.28}
            roughness={0.24}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Chooses liquid color from the active cue and phase.
 */
function getLiquidColor({
  colors,
  cueId,
  phase,
}: {
  colors: ReactionSceneColors;
  cueId: ReactionCueId;
  phase: ReactionPhase;
}) {
  if (phase === "before") {
    return colors.liquidBase;
  }

  if (cueId === GAS_CUE_ID) {
    return colors.liquidGas;
  }

  if (cueId === COLOR_CUE_ID) {
    return colors.liquidAfterColor;
  }

  if (cueId === ENERGY_CUE_ID) {
    return colors.liquidWarm;
  }

  return colors.liquidBase;
}
