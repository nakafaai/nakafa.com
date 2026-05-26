import { RoundedBox } from "@react-three/drei";
import {
  AREA_MODE_ID,
  BLOCK_DEPTH,
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  type DimensionModeId,
  LENGTH_MODE_ID,
  type SceneColors,
  VOLUME_MODE_ID,
} from "@repo/design-system/components/contents/physics/measurement/dimension/data";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";
import { THREE_FONT_SIZE } from "@repo/design-system/components/three/data/constants";
import { DoubleSide } from "three";

const GRAIN_LINES = [-0.42, -0.14, 0.18, 0.46];
const AREA_LAYER_RENDER_ORDER = 3;
const DETAIL_RENDER_ORDER = 2;
const DETAIL_SURFACE_Y = BLOCK_HEIGHT / 2 + 0.08;
const LENGTH_MARKER_Y = BLOCK_HEIGHT / 2 + 0.18;
const LENGTH_MARKER_Z = BLOCK_DEPTH / 2 + 0.18;
const LENGTH_MARKER_RADIUS = 0.035;
const REFERENCE_BLOCK_RENDER_ORDER = 1;

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
      {modeId !== VOLUME_MODE_ID && <ReferenceBlock colors={colors} />}

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
 * Keeps a faint measured solid visible behind length and area overlays.
 */
function ReferenceBlock({ colors }: { colors: SceneColors }) {
  return (
    <group>
      <RoundedBox
        args={[BLOCK_WIDTH, BLOCK_HEIGHT, BLOCK_DEPTH]}
        radius={0.08}
        renderOrder={REFERENCE_BLOCK_RENDER_ORDER}
        smoothness={5}
      >
        <meshStandardMaterial
          color={colors.block}
          depthWrite={false}
          opacity={0.14}
          polygonOffset
          polygonOffsetFactor={2}
          polygonOffsetUnits={2}
          roughness={0.74}
          transparent
        />
      </RoundedBox>

      <MeasurementBlockDetails colors={colors} />
    </group>
  );
}

/**
 * Adds subtle grooves and corner points so the reference solid reads as a real
 * measured block, not as a placeholder cube.
 */
function MeasurementBlockDetails({ colors }: { colors: SceneColors }) {
  return (
    <group>
      {GRAIN_LINES.map((z) => (
        <mesh
          key={`grain-${z}`}
          position={[0, DETAIL_SURFACE_Y, z]}
          renderOrder={DETAIL_RENDER_ORDER}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.012, 0.012, BLOCK_WIDTH * 0.82, 10]} />
          <meshStandardMaterial color={colors.blockDetail} roughness={0.72} />
        </mesh>
      ))}

      {[-1, 1].map((xSide) =>
        [-1, 1].map((zSide) => (
          <mesh
            key={`corner-${xSide}-${zSide}`}
            position={[
              (BLOCK_WIDTH / 2 - 0.18) * xSide,
              DETAIL_SURFACE_Y + 0.015,
              (BLOCK_DEPTH / 2 - 0.18) * zSide,
            ]}
            renderOrder={DETAIL_RENDER_ORDER}
          >
            <sphereGeometry args={[0.055, 18, 12]} />
            <meshStandardMaterial color={colors.blockDetail} roughness={0.65} />
          </mesh>
        ))
      )}
    </group>
  );
}

/**
 * Highlights one edge to represent a single length factor.
 */
function LengthLayer({ colors }: { colors: SceneColors }) {
  return (
    <group>
      <mesh
        position={[0, LENGTH_MARKER_Y, LENGTH_MARKER_Z]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry
          args={[LENGTH_MARKER_RADIUS, LENGTH_MARKER_RADIUS, BLOCK_WIDTH, 18]}
        />
        <meshStandardMaterial color={colors.edge} roughness={0.42} />
      </mesh>

      {[-1, 1].map((side) => (
        <mesh
          key={`length-cap-${side}`}
          position={[
            (BLOCK_WIDTH / 2) * side,
            LENGTH_MARKER_Y,
            LENGTH_MARKER_Z,
          ]}
        >
          <sphereGeometry args={[0.09, 24, 16]} />
          <meshStandardMaterial color={colors.edge} roughness={0.38} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Highlights the top face to represent two length factors.
 */
function AreaLayer({ colors }: { colors: SceneColors }) {
  return (
    <mesh
      position={[0, BLOCK_HEIGHT / 2 + 0.1, 0]}
      renderOrder={AREA_LAYER_RENDER_ORDER}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[BLOCK_WIDTH, BLOCK_DEPTH]} />
      <meshStandardMaterial
        color={colors.face}
        depthWrite={false}
        opacity={0.68}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
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
    <group>
      <RoundedBox
        args={[BLOCK_WIDTH, BLOCK_HEIGHT, BLOCK_DEPTH]}
        radius={0.08}
        renderOrder={REFERENCE_BLOCK_RENDER_ORDER}
        smoothness={5}
      >
        <meshStandardMaterial color={colors.volume} roughness={0.66} />
      </RoundedBox>

      <MeasurementBlockDetails colors={colors} />
    </group>
  );
}
