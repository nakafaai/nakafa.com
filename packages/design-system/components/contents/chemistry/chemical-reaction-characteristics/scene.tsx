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
import { SeamlessBenchSurface } from "@repo/design-system/components/contents/chemistry/surface";
import { ArrowHelper } from "@repo/design-system/components/three/arrow";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  LiquidMaterial,
} from "@repo/design-system/components/three/physical";
import { getColor } from "@repo/design-system/lib/color";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { Array as Arr } from "effect";
import { Vector2 } from "three";

const BEFORE_BEAKER_X = -1.16;
const AFTER_BEAKER_X = 1.16;
const BEAKER_SCALE = 1.08;
const BEAKER_TOP_RADIUS = 0.46;
const BEAKER_BOTTOM_RADIUS = 0.41;
const LIQUID_RADIUS = 0.375;
const GLASS_OPACITY = 0.24;
const LIQUID_OPACITY = 0.68;
const SCENE_Y = -0.12;
const SCENE_SCALE = 1.12;
const BENCH_Y = -BEAKER_WALL_HEIGHT / 2 - 0.03;
const GRADUATION_HEIGHTS = [-0.36, -0.1, 0.16, 0.42] as const;

/** Turned borosilicate beaker profile: flat base, rounded heel, straight wall, flared pouring lip. */
const BEAKER_LATHE_PROFILE = Arr.map(
  [
    [0.001, -BEAKER_WALL_HEIGHT / 2],
    [BEAKER_BOTTOM_RADIUS - 0.035, -BEAKER_WALL_HEIGHT / 2],
    [BEAKER_BOTTOM_RADIUS, -BEAKER_WALL_HEIGHT / 2 + 0.045],
    [BEAKER_BOTTOM_RADIUS + 0.015, -BEAKER_WALL_HEIGHT / 2 + 0.22],
    [BEAKER_TOP_RADIUS - 0.015, BEAKER_WALL_HEIGHT / 2 - 0.05],
    [BEAKER_TOP_RADIUS + 0.025, BEAKER_WALL_HEIGHT / 2],
  ] as const,
  ([r, y]) => new Vector2(r, y)
);

/** Concave capillary liquid meniscus inside the beaker, turned via LatheGeometry. */
const LIQUID_MENISCUS_PROFILE = Arr.map(
  [
    [0.001, LIQUID_BOTTOM_Y],
    [LIQUID_RADIUS - 0.02, LIQUID_BOTTOM_Y],
    [LIQUID_RADIUS, LIQUID_BOTTOM_Y + 0.025],
    [LIQUID_RADIUS + 0.012, LIQUID_TOP_Y + 0.028],
    [LIQUID_RADIUS - 0.028, LIQUID_TOP_Y + 0.008],
    [LIQUID_RADIUS - 0.08, LIQUID_TOP_Y],
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
      <CameraBounds exclude>
        <SeamlessBenchSurface radius={22} y={BENCH_Y * BEAKER_SCALE} />
      </CameraBounds>
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

/** Renders one 3D laboratory beaker standing on a ceramic mat. */
function ReactionBeaker({ phase, x }: { phase: ReactionPhase; x: number }) {
  const colors = useReactionCharacteristicsColors();
  const cueId = useReactionCharacteristicsCue((state) => state.cueId);

  return (
    <group position={[x, 0, 0]} scale={BEAKER_SCALE}>
      <mesh position={[0, BENCH_Y + 0.015, 0]} receiveShadow>
        <cylinderGeometry args={[0.56, 0.58, 0.03, 48]} />
        <meshStandardMaterial
          color={BENCH_COLORS.ceramicTile}
          roughness={0.42}
        />
      </mesh>
      <BeakerGlass />
      <Liquid color={getLiquidColor({ colors, cueId, phase })} />
      <ReactionCueVisual phase={phase} />
    </group>
  );
}

/** Borosilicate glass beaker turned with LatheGeometry, poured lip, and graduation ticks. */
function BeakerGlass() {
  const colors = useReactionCharacteristicsColors();
  return (
    <group>
      <mesh castShadow receiveShadow>
        <latheGeometry args={[BEAKER_LATHE_PROFILE, 72]} />
        <GlassMaterial color={colors.glass} opacity={GLASS_OPACITY} />
      </mesh>

      <mesh
        position={[0, BEAKER_WALL_HEIGHT / 2, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[BEAKER_TOP_RADIUS + 0.015, 0.014, 16, 72]} />
        <GlassMaterial color={colors.glass} opacity={0.62} />
      </mesh>

      {Arr.map(GRADUATION_HEIGHTS, (y, index) => {
        const t = (y + BEAKER_WALL_HEIGHT / 2) / BEAKER_WALL_HEIGHT;
        const radius =
          BEAKER_BOTTOM_RADIUS +
          (BEAKER_TOP_RADIUS - BEAKER_BOTTOM_RADIUS) * t +
          0.004;
        const arc = index % 2 === 0 ? Math.PI * 0.28 : Math.PI * 0.16;
        return (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[radius, 0.004, 8, 48, arc]} />
            <meshBasicMaterial
              color={getColor("WHITE")}
              depthWrite={false}
              opacity={0.65}
              transparent
            />
          </mesh>
        );
      })}
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
