import {
  BENCH,
  BENCH_TOP,
  WALLS,
} from "@repo/design-system/components/contents/biology/equipment/places";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { Turn } from "@repo/design-system/components/three/form/part";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { Array as Arr } from "effect";
import { useLayoutEffect, useRef } from "react";
import type { InstancedMesh } from "three";
import { Color, Matrix4 } from "three";

/** How far the room reaches past the corner, in metres: the floor and both walls run on out of the frame. */
const ROOM = { depth: 5, height: 2.9, width: 6 } as const;

/** The gap of grout between two tiles, in metres. */
const GROUT = 0.003;

/**
 * A field of square tiles in its own plane, facing +z, `columns` by `rows`
 * of `size` metres from its corner at the origin, each a shade lighter or
 * darker than the next, as fired tiles are.
 */
function Tiles({
  color,
  columns,
  rows,
  seed,
  size,
}: {
  readonly color: string;
  readonly columns: number;
  readonly rows: number;
  readonly seed: number;
  readonly size: readonly [number, number];
}) {
  const field = useRef<InstancedMesh>(null);
  const count = columns * rows;

  useLayoutEffect(() => {
    const mesh = field.current;
    if (mesh === null) {
      return;
    }
    const matrix = new Matrix4();
    const tint = new Color();
    for (const index of Arr.range(0, count - 1)) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      matrix.makeTranslation(
        (column + 0.5) * size[0],
        (row + 0.5) * size[1],
        0.003
      );
      mesh.setMatrixAt(index, matrix);
      tint.set(color).offsetHSL(0, 0, (hashUnit(index, seed) - 0.5) * 0.05);
      mesh.setColorAt(index, tint);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor !== null) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.computeBoundingSphere();
  });

  return (
    <instancedMesh
      args={[undefined, undefined, count]}
      receiveShadow
      ref={field}
    >
      <boxGeometry args={[size[0] - GROUT, size[1] - GROUT, 0.006]} />
      <meshPhysicalMaterial
        clearcoat={0.5}
        clearcoatRoughness={0.25}
        roughness={0.35}
      />
    </instancedMesh>
  );
}

/**
 * The corner of the room: a vinyl-tiled floor, painted back and side walls
 * with a dark skirting, and white ceramic tiles behind the bench where
 * splashes land.
 */
export function Room() {
  const splash = (BENCH.right - WALLS.side) / 15;
  return (
    <group>
      <mesh
        position={[
          WALLS.side + ROOM.width / 2,
          -0.001,
          WALLS.back + ROOM.depth / 2,
        ]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[ROOM.width, ROOM.depth]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.floorGrout}
          roughness={0.9}
        />
      </mesh>
      <group
        position={[WALLS.side, -0.006, WALLS.back]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[1, -1, 1]}
      >
        <Tiles
          color={LABORATORY_COLORS.floorTile}
          columns={20}
          rows={17}
          seed={3}
          size={[0.3, 0.3]}
        />
      </group>
      <mesh
        position={[
          WALLS.side + ROOM.width / 2,
          ROOM.height / 2,
          WALLS.back - 0.05,
        ]}
        receiveShadow
      >
        <boxGeometry args={[ROOM.width, ROOM.height, 0.1]} />
        <meshStandardMaterial color={LABORATORY_COLORS.wall} roughness={0.93} />
      </mesh>
      <mesh
        position={[
          WALLS.side - 0.05,
          ROOM.height / 2,
          WALLS.back + ROOM.depth / 2,
        ]}
        receiveShadow
      >
        <boxGeometry args={[0.1, ROOM.height, ROOM.depth]} />
        <meshStandardMaterial color={LABORATORY_COLORS.wall} roughness={0.93} />
      </mesh>
      <mesh
        position={[
          BENCH.right + (ROOM.width - BENCH.right + WALLS.side) / 2,
          0.05,
          WALLS.back + 0.006,
        ]}
      >
        <boxGeometry
          args={[ROOM.width - BENCH.right + WALLS.side, 0.1, 0.012]}
        />
        <meshStandardMaterial
          color={LABORATORY_COLORS.skirting}
          roughness={0.6}
        />
      </mesh>
      <mesh
        position={[
          WALLS.side + 0.006,
          0.05,
          (BENCH.front + WALLS.back + ROOM.depth) / 2,
        ]}
      >
        <boxGeometry
          args={[0.012, 0.1, WALLS.back + ROOM.depth - BENCH.front]}
        />
        <meshStandardMaterial
          color={LABORATORY_COLORS.skirting}
          roughness={0.6}
        />
      </mesh>
      <mesh
        position={[
          (WALLS.side + BENCH.right) / 2,
          BENCH_TOP + 0.225,
          WALLS.back + 0.001,
        ]}
      >
        <planeGeometry args={[BENCH.right - WALLS.side, 0.45]} />
        <meshStandardMaterial color={LABORATORY_COLORS.grout} roughness={0.9} />
      </mesh>
      <group position={[WALLS.side, BENCH_TOP, WALLS.back]}>
        <Tiles
          color={LABORATORY_COLORS.wallTile}
          columns={15}
          rows={3}
          seed={7}
          size={[splash, 0.15]}
        />
      </group>
      <mesh
        position={[
          WALLS.side + 0.001,
          BENCH_TOP + 0.225,
          (WALLS.back + BENCH.front) / 2,
        ]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <planeGeometry args={[BENCH.front - WALLS.back, 0.45]} />
        <meshStandardMaterial color={LABORATORY_COLORS.grout} roughness={0.9} />
      </mesh>
      <group
        position={[WALLS.side, BENCH_TOP, BENCH.front]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <Tiles
          color={LABORATORY_COLORS.wallTile}
          columns={5}
          rows={3}
          seed={11}
          size={[0.15, 0.15]}
        />
      </group>
      <Shelf />
      <Socket />
    </group>
  );
}

/** A 250 mL reagent bottle's outline, 70 mm across: body, shoulder and neck. */
const BOTTLE = [
  [0, 0],
  [0.033, 0],
  [0.035, 0.004],
  [0.035, 0.1],
  [0.03, 0.115],
  [0.014, 0.126],
  [0.0125, 0.14],
] as const;

/** The shelf over the bench, its height above the floor and its span along the back wall, in metres. */
const SHELF = { from: -0.5, height: 1.55, to: 0.55 } as const;

/** The bottles along the shelf: amber for what light spoils, clear for the rest. */
const BOTTLES = Arr.map(Arr.range(0, 5), (index) => ({
  color: index % 3 === 1 ? BENCH_COLORS.bottleClear : BENCH_COLORS.bottleAmber,
  key: index,
  x: SHELF.from + 0.12 + index * 0.16,
}));

/** A laminate shelf on two steel brackets over the bench, with a row of reagent bottles. */
function Shelf() {
  const length = SHELF.to - SHELF.from;
  return (
    <group position={[(SHELF.from + SHELF.to) / 2, SHELF.height, WALLS.back]}>
      <mesh castShadow position={[0, -0.0125, 0.11]} receiveShadow>
        <boxGeometry args={[length, 0.025, 0.22]} />
        <meshStandardMaterial color={LABORATORY_COLORS.shelf} roughness={0.6} />
      </mesh>
      {Arr.map([-0.4, 0.4] as const, (share) => (
        <mesh castShadow key={share} position={[share * length, -0.06, 0.08]}>
          <boxGeometry args={[0.02, 0.07, 0.16]} />
          <MetalMaterial color={LABORATORY_COLORS.steel} roughness={0.4} />
        </mesh>
      ))}
      {Arr.map(BOTTLES, (bottle) => (
        <group
          key={bottle.key}
          position={[bottle.x - (SHELF.from + SHELF.to) / 2, 0, 0.11]}
        >
          <mesh castShadow>
            <Turn profile={BOTTLE} wall={0.003} />
            <meshPhysicalMaterial
              clearcoat={1}
              color={bottle.color}
              opacity={0.9}
              roughness={0.12}
              transparent
            />
          </mesh>
          <mesh castShadow position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.016, 0.016, 0.022, 24]} />
            <meshStandardMaterial
              color={BENCH_COLORS.bottleCap}
              roughness={0.6}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** A double switched socket on the tiles behind the microscope, for its lamp. */
function Socket() {
  return (
    <group position={[0.36, BENCH_TOP + 0.2, WALLS.back + 0.011]}>
      <mesh castShadow>
        <boxGeometry args={[0.146, 0.086, 0.01]} />
        <meshPhysicalMaterial
          clearcoat={0.4}
          color={LABORATORY_COLORS.socket}
          roughness={0.4}
        />
      </mesh>
      {Arr.map([-0.036, 0.036] as const, (x) => (
        <group key={x} position={[x, 0, 0.005]}>
          <mesh position={[0, -0.012, 0]}>
            <boxGeometry args={[0.012, 0.004, 0.001]} />
            <meshBasicMaterial color={LABORATORY_COLORS.strap} />
          </mesh>
          <mesh position={[0.02, 0.022, 0.002]}>
            <boxGeometry args={[0.012, 0.016, 0.004]} />
            <meshStandardMaterial
              color={LABORATORY_COLORS.socket}
              roughness={0.5}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
