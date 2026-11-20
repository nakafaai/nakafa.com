import { RoundedBox } from "@react-three/drei";
import type {
  DimensionModeId,
  SceneColors,
} from "@repo/design-system/components/contents/physics/measurement/dimension/data";
import {
  AREA_MODE_ID,
  BLOCK_DEPTH,
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  LENGTH_MODE_ID,
  VOLUME_MODE_ID,
} from "@repo/design-system/components/contents/physics/measurement/dimension/data";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import type { Placement } from "@repo/design-system/components/three/repeat";
import { Repeat } from "@repo/design-system/components/three/repeat";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr } from "effect";

/** The tape's graduations: a tick every two centimetres of the scene, longer at each tenth. */
const TAPE_TICKS: readonly Placement[] = Arr.makeBy(
  Math.round(BLOCK_WIDTH / 0.1) + 1,
  (index) => ({
    position: [
      -BLOCK_WIDTH / 2 + index * 0.1,
      0.004,
      index % 5 === 0 ? 0.03 : 0.05,
    ],
    scale: [1, 1, index % 5 === 0 ? 1.6 : 1],
  })
);

/** Where the tape lies: along the front edge of the block's top. */
const TAPE_Y = BLOCK_HEIGHT / 2 + 0.006;
const TAPE_Z = BLOCK_DEPTH / 2 - 0.1;

/**
 * Renders the selected geometric meaning of a length dimension on one real
 * timber block: a steel tape along an edge for one length factor, the top
 * face picked out for two, and the whole solid wrapped for three.
 */
export function DimensionScene({
  colors,
  modeId,
  powerLabel,
}: {
  colors: SceneColors;
  modeId: DimensionModeId;
  powerLabel: string;
}) {
  return (
    <group rotation={[-0.15, -0.45, 0]}>
      <RoundedBox
        args={[BLOCK_WIDTH, BLOCK_HEIGHT, BLOCK_DEPTH]}
        castShadow
        radius={0.04}
        receiveShadow
        smoothness={4}
      >
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.pine}
          repeat={[2, 1]}
          surface="wood"
        />
      </RoundedBox>

      {modeId === LENGTH_MODE_ID && <Tape />}
      {modeId === AREA_MODE_ID && <AreaLayer colors={colors} />}
      {modeId === VOLUME_MODE_ID && <VolumeLayer colors={colors} />}

      <ThreeLabel
        color={colors.text}
        fontSize="display"
        position={[0, 1.35, 1.05]}
      >
        <InlineMath math={powerLabel} />
      </ThreeLabel>
    </group>
  );
}

/**
 * A steel tape measure pulled out along the front edge of the block: the
 * yellow blade with its black graduations, the brass hook over the far end,
 * and the case at the near end.
 */
function Tape() {
  return (
    <group position={[0, TAPE_Y, TAPE_Z]}>
      <mesh receiveShadow>
        <boxGeometry args={[BLOCK_WIDTH + 0.04, 0.008, 0.18]} />
        <SurfaceMaterial color={INSTRUMENT_COLORS.tapeYellow} surface="paint" />
      </mesh>
      <Repeat placements={TAPE_TICKS} shadows={false}>
        <boxGeometry args={[0.012, 0.002, 0.06]} />
        <meshStandardMaterial color={CAR_COLORS.tyre} roughness={0.6} />
      </Repeat>
      <mesh castShadow position={[BLOCK_WIDTH / 2 + 0.03, -0.05, 0]}>
        <boxGeometry args={[0.02, 0.12, 0.18]} />
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.brass}
          metalness={1}
          roughness={0.4}
          surface="brushed"
        />
      </mesh>
      <RoundedBox
        args={[0.5, 0.5, 0.24]}
        castShadow
        position={[-BLOCK_WIDTH / 2 - 0.28, 0.2, 0]}
        radius={0.1}
        smoothness={4}
      >
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.tapeYellow}
          surface="plastic"
        />
      </RoundedBox>
    </group>
  );
}

/**
 * Picks out the top face to represent two length factors.
 */
function AreaLayer({ colors }: { colors: SceneColors }) {
  return (
    <mesh
      position={[0, BLOCK_HEIGHT / 2 + 0.004, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[BLOCK_WIDTH - 0.06, BLOCK_DEPTH - 0.06]} />
      <meshStandardMaterial
        color={colors.face}
        depthWrite={false}
        opacity={0.55}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
        transparent
      />
    </mesh>
  );
}

/**
 * Wraps the whole solid to represent three length factors.
 */
function VolumeLayer({ colors }: { colors: SceneColors }) {
  return (
    <RoundedBox
      args={[BLOCK_WIDTH + 0.06, BLOCK_HEIGHT + 0.06, BLOCK_DEPTH + 0.06]}
      radius={0.06}
      smoothness={4}
    >
      <meshPhysicalMaterial
        clearcoat={1}
        color={colors.volume}
        depthWrite={false}
        opacity={0.2}
        roughness={0.1}
        transparent
      />
    </RoundedBox>
  );
}
