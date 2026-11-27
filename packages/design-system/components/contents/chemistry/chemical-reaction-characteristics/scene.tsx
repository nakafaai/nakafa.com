import { RoundedBox } from "@react-three/drei";
import {
  useReactionCharacteristicsColors,
  useReactionCharacteristicsCue,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-characteristics/context";
import {
  BEAKER_WALL_HEIGHT,
  ColorParticles,
  GasBubbles,
  LabThermometer,
  LIQUID_BOTTOM_Y,
  LIQUID_TOP_Y,
  Precipitate,
  ThermalSteam,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-characteristics/cues";
import type {
  ReactionCueId,
  ReactionSceneColors,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-characteristics/data";
import {
  COLOR_CUE_ID,
  ENERGY_CUE_ID,
  GAS_CUE_ID,
  PRECIPITATE_CUE_ID,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-characteristics/data";
import type { ReactionCharacteristicsLabProps } from "@repo/design-system/components/contents/chemistry/chemical-reaction-characteristics/lab";
import { createBeakerMarkingsTexture } from "@repo/design-system/components/contents/chemistry/glassware";
import { ArrowHelper } from "@repo/design-system/components/three/arrow";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  LiquidMaterial,
} from "@repo/design-system/components/three/physical";
import { getColor } from "@repo/design-system/lib/color";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { Vector2 } from "three";

const BEFORE_BEAKER_X = -1.16;
const AFTER_BEAKER_X = 1.16;
const BEAKER_SCALE = 1.08;
const BEAKER_RADIUS = 0.44;
const LIQUID_RADIUS = 0.4;
const GLASS_OPACITY = 0.24;
const LIQUID_OPACITY = 0.68;
const SCENE_Y = -0.12;
const SCENE_SCALE = 1.12;
const TILE = { side: 1.5, thick: 0.03 } as const;
const BENCH_Y = -BEAKER_WALL_HEIGHT / 2 - TILE.thick;

/** How thick the beaker's wall and its base are drawn. */
const WALL = 0.022;
const BASE = 0.034;

/**
 * A Griffin beaker's wall in section, turned on the lathe: a thick flat
 * base, a rounded heel, a straight wall, a rim that flares and rolls over,
 * and the inner wall back down, so the glass has a real thickness to refract
 * and catch the light.
 */
const BEAKER_LATHE_PROFILE = Arr.map(
  [
    [0.001, -BEAKER_WALL_HEIGHT / 2],
    [BEAKER_RADIUS - 0.05, -BEAKER_WALL_HEIGHT / 2],
    [BEAKER_RADIUS - 0.012, -BEAKER_WALL_HEIGHT / 2 + 0.012],
    [BEAKER_RADIUS, -BEAKER_WALL_HEIGHT / 2 + 0.05],
    [BEAKER_RADIUS, BEAKER_WALL_HEIGHT / 2 - 0.06],
    [BEAKER_RADIUS + 0.012, BEAKER_WALL_HEIGHT / 2 - 0.025],
    [BEAKER_RADIUS + 0.034, BEAKER_WALL_HEIGHT / 2 - 0.004],
    [BEAKER_RADIUS + 0.036, BEAKER_WALL_HEIGHT / 2 + 0.006],
    [BEAKER_RADIUS + 0.024, BEAKER_WALL_HEIGHT / 2 + 0.01],
    [BEAKER_RADIUS - WALL, BEAKER_WALL_HEIGHT / 2 - 0.05],
    [BEAKER_RADIUS - WALL, -BEAKER_WALL_HEIGHT / 2 + BASE + 0.03],
    [BEAKER_RADIUS - WALL - 0.03, -BEAKER_WALL_HEIGHT / 2 + BASE],
    [0.001, -BEAKER_WALL_HEIGHT / 2 + BASE],
  ] as const,
  ([r, y]) => new Vector2(r, y)
);

/** Concave capillary liquid meniscus inside the beaker, turned via LatheGeometry. */
const LIQUID_MENISCUS_PROFILE = Arr.map(
  [
    [0.001, LIQUID_BOTTOM_Y],
    [LIQUID_RADIUS - 0.03, LIQUID_BOTTOM_Y],
    [LIQUID_RADIUS, LIQUID_BOTTOM_Y + 0.03],
    [LIQUID_RADIUS, LIQUID_TOP_Y + 0.03],
    [LIQUID_RADIUS - 0.012, LIQUID_TOP_Y + 0.012],
    [LIQUID_RADIUS - 0.04, LIQUID_TOP_Y + 0.003],
    [LIQUID_RADIUS - 0.09, LIQUID_TOP_Y],
    [0.001, LIQUID_TOP_Y],
  ] as const,
  ([r, y]) => new Vector2(r, y)
);

type ReactionPhase = "after" | "before";

/**
 * Renders a paired 3D laboratory beaker scene on an epoxy bench for the selected reaction clue.
 */
export function ReactionCharacteristicsScene({
  labels,
}: {
  labels: ReactionCharacteristicsLabProps["labels"];
}) {
  const colors = useReactionCharacteristicsColors();

  return (
    <group position={[0, SCENE_Y, 0]} scale={SCENE_SCALE}>
      <ThreeLabel
        anchorY="bottom"
        color={colors.text}
        fontSize="compact"
        position={[BEFORE_BEAKER_X, 1, 0]}
      >
        {labels.before}
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={colors.text}
        fontSize="compact"
        position={[AFTER_BEAKER_X, 1, 0]}
      >
        {labels.after}
      </ThreeLabel>
      <ReactionBeaker phase="before" x={BEFORE_BEAKER_X} />
      <ArrowHelper
        arrowSize={0.22}
        color={getColor("WHITE")}
        from={[-0.36, 0.02, 0]}
        lineWidth={3}
        to={[0.36, 0.02, 0]}
      />
      <ReactionBeaker phase="after" x={AFTER_BEAKER_X} />
    </group>
  );
}

/** One beaker on a glazed white tile, which shows the colour of what it holds. */
function ReactionBeaker({ phase, x }: { phase: ReactionPhase; x: number }) {
  const colors = useReactionCharacteristicsColors();
  const cueId = useReactionCharacteristicsCue((state) => state.cueId);

  return (
    <group position={[x, 0, 0]} scale={BEAKER_SCALE}>
      <RoundedBox
        args={[TILE.side, TILE.thick, TILE.side]}
        castShadow
        position={[0, BENCH_Y + TILE.thick / 2, 0]}
        radius={0.014}
        receiveShadow
        smoothness={4}
      >
        <meshPhysicalMaterial
          clearcoat={0.9}
          clearcoatRoughness={0.12}
          color={BENCH_COLORS.ceramicTile}
          roughness={0.3}
        />
      </RoundedBox>
      <BeakerGlass />
      <Liquid color={getLiquidColor({ colors, cueId, phase })} />
      <ReactionCueVisual phase={phase} />
    </group>
  );
}

/** A borosilicate Griffin beaker with a pouring spout and its printed scale. */
function BeakerGlass() {
  const colors = useReactionCharacteristicsColors();
  const markings = useMemo(createBeakerMarkingsTexture, []);
  useEffect(() => () => markings?.dispose(), [markings]);

  return (
    <group>
      <mesh castShadow renderOrder={2}>
        <latheGeometry args={[BEAKER_LATHE_PROFILE, 96]} />
        <GlassMaterial color={colors.glass} opacity={GLASS_OPACITY} />
      </mesh>
      <mesh
        position={[BEAKER_RADIUS + 0.03, BEAKER_WALL_HEIGHT / 2 - 0.012, 0]}
        rotation={[0, 0, -0.42]}
        scale={[1.15, 0.6, 0.8]}
      >
        <cylinderGeometry args={[0.05, 0.075, 0.11, 24, 1, true, -1.2, 2.4]} />
        <GlassMaterial color={colors.glass} opacity={0.5} />
      </mesh>
      {markings === null ? null : (
        <mesh position={[0, 0.02, 0]} renderOrder={3} rotation={[0, 2.2, 0]}>
          <cylinderGeometry
            args={[
              BEAKER_RADIUS + 0.003,
              BEAKER_RADIUS + 0.003,
              BEAKER_WALL_HEIGHT * 0.78,
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
    </group>
  );
}

/** Liquid volume inside the beaker with a turned concave meniscus surface. */
function Liquid({ color }: { color: string }) {
  return (
    <mesh>
      <latheGeometry args={[LIQUID_MENISCUS_PROFILE, 64]} />
      <LiquidMaterial color={color} opacity={LIQUID_OPACITY} />
    </mesh>
  );
}

/** Chooses the visible 3D cue for the active state. */
function ReactionCueVisual({ phase }: { phase: ReactionPhase }) {
  const colors = useReactionCharacteristicsColors();
  const cueId = useReactionCharacteristicsCue((state) => state.cueId);
  if (cueId === ENERGY_CUE_ID) {
    return (
      <group>
        <LabThermometer color={colors.heat} warm={phase === "after"} />
        {phase === "after" ? <ThermalSteam /> : null}
      </group>
    );
  }

  if (phase === "before") {
    return null;
  }

  if (cueId === GAS_CUE_ID) {
    return <GasBubbles />;
  }

  if (cueId === PRECIPITATE_CUE_ID) {
    return <Precipitate color={colors.precipitate} />;
  }

  if (cueId === COLOR_CUE_ID) {
    return <ColorParticles color={colors.liquidAfterColor} />;
  }

  return null;
}

/** Chooses liquid color from the active cue and phase. */
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
