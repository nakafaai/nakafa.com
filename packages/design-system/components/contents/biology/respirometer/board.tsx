import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { scaleNumbers } from "@repo/design-system/components/contents/biology/respirometer/gas";
import { CAPILLARY } from "@repo/design-system/components/contents/biology/respirometer/glass";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { RESPIROMETER_COLORS } from "@repo/design-system/lib/material/respirometer";
import { Array as Arr } from "effect";
import type { RefObject } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Group, InstancedMesh } from "three";
import { Matrix4, Quaternion, Vector3 } from "three";

/** The scale board's plywood, in metres: how thick it is and how far it runs past the scales on each side. */
export const BOARD = { margin: 0.012, thickness: 0.006 } as const;

/** How far in front of the board's face the capillaries' axes run, in metres: just clear of the glass. */
export const FACE_GAP = CAPILLARY.radius + 0.0015;

/** How far the board runs on past the scales' far end, where its clamp takes it, in metres. */
const GRIP_ROOM = 0.026;

/** How far the board runs on past the scales' near end, where each prints its unit, in metres. */
const UNIT_ROOM = 0.02;

/** How far above and below the capillaries the board reaches past the scale's numbers, in metres. */
const BOARD_REACH = 0.026;

/** How long a tick is at `mm` millimetres, in metres: 6 mm every centimetre, 4 mm every half, 2.5 mm between. */
function tickLength(mm: number) {
  if (mm % 10 === 0) {
    return 0.006;
  }
  return mm % 5 === 0 ? 0.004 : 0.0025;
}

/** Where a reading of `mm` millimetres stands along the board, in metres: readings grow to the left, towards the seeds. */
export function along(mm: number) {
  return -mm / 1000;
}

/**
 * The board's frame: from the farthest reading `to` on the left to the
 * clamp's room past the drop's tail `from` on the right, and from below
 * the lower lane to above the upper, in metres.
 */
export function boardFrame(
  from: number,
  to: number,
  lanes: readonly [number, number]
) {
  return {
    bottom: Math.min(...lanes) - BOARD_REACH,
    left: along(to) - BOARD.margin - UNIT_ROOM,
    right: along(from) + BOARD.margin + GRIP_ROOM,
    top: Math.max(...lanes) + BOARD_REACH,
  };
}

/** One scale on the board: the height of the capillary it reads, and whether its ticks and numbers stand above (1) or below (−1) it. */
type Lane = readonly [number, 1 | -1];

/**
 * The white-faced scale board that stands behind both capillaries, its
 * front face at z = 0 and its zero at x = 0: a millimetre scale printed
 * along each capillary from `from` to `to`, numbered in centimetres every
 * `step` millimetres from `back`, with a spring clip holding each capillary
 * near its open end.
 */
export function ScaleBoard({
  back,
  from,
  lanes,
  step,
  to,
}: {
  readonly back: number;
  readonly from: number;
  readonly lanes: readonly [Lane, Lane];
  readonly step: number;
  readonly to: number;
}) {
  const frame = boardFrame(from, to, [lanes[0][0], lanes[1][0]]);
  const numbers = scaleNumbers(back, to, step);
  const width = frame.right - frame.left;
  const height = frame.top - frame.bottom;
  return (
    <group>
      <RoundedBox
        args={[width, height, BOARD.thickness]}
        castShadow
        position={[
          (frame.left + frame.right) / 2,
          (frame.top + frame.bottom) / 2,
          -BOARD.thickness / 2,
        ]}
        radius={0.0015}
        receiveShadow
        smoothness={2}
      >
        <meshStandardMaterial
          color={RESPIROMETER_COLORS.boardEdge}
          roughness={0.8}
        />
      </RoundedBox>
      <mesh
        position={[
          (frame.left + frame.right) / 2,
          (frame.top + frame.bottom) / 2,
          0.000_05,
        ]}
        receiveShadow
      >
        <planeGeometry args={[width - 0.002, height - 0.002]} />
        <meshStandardMaterial
          color={RESPIROMETER_COLORS.board}
          roughness={0.85}
        />
      </mesh>
      {Arr.map(lanes, ([height, side]) => (
        <group key={height} position={[0, height, 0]}>
          <Scale from={from} numbers={numbers} side={side} to={to} />
          <group position={[along(from) + 0.006, 0, 0]}>
            <Clip />
          </group>
        </group>
      ))}
    </group>
  );
}

/**
 * Whether the camera stands in front of the face of the board that holds
 * `face`, its plane at z = 0 of that group: printed numbers drawn over the
 * scene would otherwise show through the board from behind. The answer
 * changes only as the camera crosses the plane, so the card re-renders
 * only then.
 */
function useFacing(face: RefObject<Group | null>) {
  const [facing, setFacing] = useState(true);
  const eye = useMemo(() => new Vector3(), []);
  useFrame(({ camera }) => {
    const group = face.current;
    if (group === null) {
      return;
    }
    const front = group.worldToLocal(eye.copy(camera.position)).z > 0;
    if (front !== facing) {
      setFacing(front);
    }
  });
  return facing;
}

/** How far a scale's baseline stands from its capillary's axis, in metres, clear of the glass. */
const BASELINE = CAPILLARY.radius + 0.0012;

/**
 * One printed scale whose capillary runs along y = 0: a baseline, a tick
 * every millimetre from `from` to `to` reaching away from the capillary on
 * `side`, and the centimetre numbers at the `numbers` readings, beyond the
 * long ticks.
 */
function Scale({
  from,
  numbers,
  side,
  to,
}: {
  readonly from: number;
  readonly numbers: readonly number[];
  readonly side: 1 | -1;
  readonly to: number;
}) {
  const ticks = useRef<InstancedMesh>(null);
  const face = useRef<Group>(null);
  const facing = useFacing(face);
  const readings = Arr.range(from, to);

  useLayoutEffect(() => {
    const mesh = ticks.current;
    if (mesh === null) {
      return;
    }
    const matrix = new Matrix4();
    const scale = new Vector3();
    const place = new Vector3();
    const turn = new Quaternion();
    Arr.forEach(readings, (mm, index) => {
      const length = tickLength(mm);
      scale.set(1, length, 1);
      place.set(along(mm), side * (BASELINE + length / 2), 0.0001);
      mesh.setMatrixAt(index, matrix.compose(place, turn, scale));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  });

  return (
    <group ref={face}>
      <instancedMesh args={[undefined, undefined, readings.length]} ref={ticks}>
        <boxGeometry args={[0.000_32, 1, 0.0001]} />
        <meshBasicMaterial color={RESPIROMETER_COLORS.ink} />
      </instancedMesh>
      <mesh position={[(along(from) + along(to)) / 2, side * BASELINE, 0.0001]}>
        <boxGeometry args={[(to - from) / 1000, 0.0003, 0.0001]} />
        <meshBasicMaterial color={RESPIROMETER_COLORS.ink} />
      </mesh>
      {Arr.map(numbers, (mm) => (
        <ThreeLabel
          anchorY={side === 1 ? "bottom" : "top"}
          color={RESPIROMETER_COLORS.ink}
          fontSize={0.005}
          key={mm}
          maximumFontSize={15}
          outlineColor={RESPIROMETER_COLORS.board}
          outlineWidth={0.0008}
          position={[along(mm), side * (BASELINE + 0.0072), 0.0002]}
          visible={facing}
        >
          {mm < 0 ? `\u2212${-mm / 10}` : mm / 10}
        </ThreeLabel>
      ))}
      <ThreeLabel
        anchorX="right"
        anchorY={side === 1 ? "bottom" : "top"}
        color={RESPIROMETER_COLORS.ink}
        fontSize={0.005}
        maximumFontSize={15}
        outlineColor={RESPIROMETER_COLORS.board}
        outlineWidth={0.0008}
        position={[along(to) - 0.012, side * (BASELINE + 0.0072), 0.0002]}
        visible={facing}
      >
        cm
      </ThreeLabel>
    </group>
  );
}

/** A spring-steel clip screwed to the board, its loop round the front of the capillary. */
function Clip() {
  const loop = CAPILLARY.radius + 0.0006;
  return (
    <group>
      <mesh
        castShadow
        position={[0, 0, FACE_GAP]}
        rotation={[0, -Math.PI / 2, -Math.PI / 2]}
      >
        <torusGeometry args={[loop, 0.000_45, 6, 20, Math.PI]} />
        <MetalMaterial color={RESPIROMETER_COLORS.zinc} roughness={0.3} />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <group key={side}>
          <mesh
            position={[0, side * loop, FACE_GAP / 2]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.000_45, 0.000_45, FACE_GAP, 6]} />
            <MetalMaterial color={RESPIROMETER_COLORS.zinc} roughness={0.3} />
          </mesh>
          <mesh
            position={[0, side * (loop + 0.0014), 0.0004]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.0013, 0.0013, 0.0008, 12]} />
            <MetalMaterial color={RESPIROMETER_COLORS.zinc} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
