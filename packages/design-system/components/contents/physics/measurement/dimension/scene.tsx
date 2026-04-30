import { RoundedBox } from "@react-three/drei";
import {
  AREA_MODE_ID,
  BLOCK_DEPTH,
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  type DimensionModeId,
  HIGHLIGHT_THICKNESS,
  LENGTH_MODE_ID,
  type SceneColors,
  VOLUME_MODE_ID,
} from "@repo/design-system/components/contents/physics/measurement/dimension/data";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";
import { THREE_FONT_SIZE } from "@repo/design-system/components/three/data/constants";
import { DoubleSide } from "three";

/**
 * Renders the selected geometric meaning of a length dimension.
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
      <BaseBlock colors={colors} modeId={modeId} />

      {modeId === LENGTH_MODE_ID && <LengthLayer colors={colors} />}
      {modeId === AREA_MODE_ID && <AreaLayer colors={colors} />}
      {modeId === VOLUME_MODE_ID && <VolumeLayer colors={colors} />}

      <SceneLabel
        color={colors.text}
        fontSize={THREE_FONT_SIZE.display}
        position={[0, 1.35, 1.05]}
      >
        {powerLabel}
      </SceneLabel>
    </group>
  );
}

/**
 * Keeps the reference solid visible while changing emphasis per mode.
 */
function BaseBlock({
  colors,
  modeId,
}: {
  colors: SceneColors;
  modeId: DimensionModeId;
}) {
  const opacity = modeId === VOLUME_MODE_ID ? 0.42 : 0.14;

  return (
    <RoundedBox
      args={[BLOCK_WIDTH, BLOCK_HEIGHT, BLOCK_DEPTH]}
      radius={0.04}
      smoothness={4}
    >
      <meshStandardMaterial
        color={colors.block}
        opacity={opacity}
        transparent
      />
    </RoundedBox>
  );
}

/**
 * Highlights one edge to represent a single length factor.
 */
function LengthLayer({ colors }: { colors: SceneColors }) {
  return (
    <mesh position={[0, BLOCK_HEIGHT / 2 + 0.12, BLOCK_DEPTH / 2 + 0.12]}>
      <boxGeometry args={[BLOCK_WIDTH, HIGHLIGHT_THICKNESS, 0.06]} />
      <meshStandardMaterial color={colors.edge} />
    </mesh>
  );
}

/**
 * Highlights the top face to represent two length factors.
 */
function AreaLayer({ colors }: { colors: SceneColors }) {
  return (
    <mesh
      position={[0, BLOCK_HEIGHT / 2 + 0.03, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[BLOCK_WIDTH, BLOCK_DEPTH]} />
      <meshStandardMaterial
        color={colors.face}
        opacity={0.68}
        side={DoubleSide}
        transparent
      />
    </mesh>
  );
}

/**
 * Highlights the whole solid to represent three length factors.
 */
function VolumeLayer({ colors }: { colors: SceneColors }) {
  return (
    <RoundedBox
      args={[BLOCK_WIDTH, BLOCK_HEIGHT, BLOCK_DEPTH]}
      radius={0.04}
      smoothness={4}
    >
      <meshStandardMaterial color={colors.volume} opacity={0.58} transparent />
    </RoundedBox>
  );
}
