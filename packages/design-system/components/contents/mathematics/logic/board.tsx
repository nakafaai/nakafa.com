import {
  BOARD,
  BOARD_TOP,
  HOLE,
} from "@repo/design-system/components/contents/mathematics/logic/rig";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { LOGIC_COLORS } from "@repo/design-system/lib/material/logic";
import { Array as Arr } from "effect";
import { useLayoutEffect, useMemo, useRef } from "react";
import { type InstancedMesh, Object3D } from "three";

/** The desk's top, wider and deeper than the board, its top face at y = 0. */
const DESK = { depth: 0.9, height: 0.03, width: 1.6 } as const;

/** The holes of the pegboard, a pitch apart, kept a pitch clear of every edge. */
function holeSpots() {
  const columns = Math.floor(BOARD.width / HOLE.pitch) - 1;
  const rows = Math.floor(BOARD.depth / HOLE.pitch) - 1;
  return Arr.flatMap(Arr.range(0, rows - 1), (row) =>
    Arr.map(Arr.range(0, columns - 1), (column) => ({
      x: (column - (columns - 1) / 2) * HOLE.pitch,
      z: (row - (rows - 1) / 2) * HOLE.pitch,
    }))
  );
}

/** The oak desk the board lies on, its grain at the real width of oak growth rings. */
export function Desk() {
  return (
    <mesh position={[0, -DESK.height / 2, -0.12]} receiveShadow>
      <boxGeometry args={[DESK.width, DESK.height, DESK.depth]} />
      <SurfaceMaterial
        bump={0.04}
        color={LOGIC_COLORS.desk}
        repeat={[3, 24]}
        roughness={0.5}
        surface="wood"
      />
    </mesh>
  );
}

/**
 * A sheet of tempered hardboard pegboard, its smooth face up and its holes
 * an inch apart, as a school circuit kit is built on.
 */
export function Pegboard() {
  const spots = useMemo(holeSpots, []);
  const holes = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = holes.current;
    if (mesh === null) {
      return;
    }
    const place = new Object3D();
    Arr.forEach(spots, ({ x, z }, index) => {
      place.position.set(x, BOARD_TOP + 0.0002, z);
      place.rotation.set(-Math.PI / 2, 0, 0);
      place.updateMatrix();
      mesh.setMatrixAt(index, place.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [spots]);

  return (
    <group>
      <mesh castShadow position={[0, BOARD_TOP / 2, 0]} receiveShadow>
        <boxGeometry args={[BOARD.width, BOARD.thickness, BOARD.depth]} />
        <SurfaceMaterial
          bump={0.05}
          color={LOGIC_COLORS.hardboard}
          repeat={[3, 2]}
          roughness={0.62}
          surface="paint"
        />
      </mesh>
      <instancedMesh
        args={[undefined, undefined, spots.length]}
        receiveShadow
        ref={holes}
      >
        <circleGeometry args={[HOLE.radius, 20]} />
        <meshStandardMaterial color={LOGIC_COLORS.hole} roughness={0.95} />
      </instancedMesh>
    </group>
  );
}
