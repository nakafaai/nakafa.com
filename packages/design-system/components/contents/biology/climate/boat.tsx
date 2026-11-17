import { ECOLOGY_COLORS } from "@repo/design-system/lib/material/ecology";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, Color, DoubleSide } from "three";

/** A fishing perahu 7 m long and 1.5 m in the beam, at anchor off the front of the village. */
const HULL = { beam: 1.5, length: 7 } as const;

/**
 * Where the boat lies at anchor, seaward of where a sea wall would stand and
 * north of the houses, swung a little on its cable.
 */
export const MOORING = [-28, 0, 12.5] as const;

/** How many sections run along the hull and how many points round each one. */
const GRID = { across: 18, along: 44 } as const;

/**
 * A point of the hull: `u` from stern to bow, `v` from one gunwale through
 * the keel to the other. The beam swells amidships and closes to a stem at
 * each end, the sheer sweeps up at both ends as a perahu's does, and the
 * keel sits 0.3 m under the water.
 */
function hullPoint(u: number, v: number) {
  const end = Math.abs(2 * u - 1);
  const half = (HULL.beam / 2) * (1 - end ** 2.2) ** 0.8;
  const top = 0.55 + 0.4 * end ** 3;
  const keel = -0.3 * (1 - end ** 4);
  const turn = v * (Math.PI / 2);
  return [
    (u - 0.5) * HULL.length,
    keel + (top - keel) * (1 - Math.cos(turn)),
    half * Math.sin(turn),
  ] as const;
}

/** The paint at a point of the hull: the sheer strake along each gunwale, the boot under the waterline, and the topsides between. */
function paintAt(v: number, height: number) {
  if (Math.abs(v) > 0.86) {
    return "trim";
  }
  return height < 0.02 ? "boot" : "hull";
}

/** The hull as one painted shell: blue topsides, a red sheer strake, and a darker boot under the waterline. */
function hullGeometry() {
  const paint = {
    boot: new Color(ECOLOGY_COLORS.boatHull).multiplyScalar(0.45),
    hull: new Color(ECOLOGY_COLORS.boatHull),
    trim: new Color(ECOLOGY_COLORS.boatTrim),
  };
  const points = Arr.flatMap(Arr.range(0, GRID.along), (row) =>
    Arr.map(Arr.range(0, GRID.across), (column) => {
      const v = (column / GRID.across) * 2 - 1;
      const point = hullPoint(row / GRID.along, v);
      return { color: paint[paintAt(v, point[1])], point };
    })
  );
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(
      new Float32Array(Arr.flatMap(points, ({ point }) => [...point])),
      3
    )
  );
  geometry.setAttribute(
    "color",
    new BufferAttribute(
      new Float32Array(
        Arr.flatMap(points, ({ color }) => [color.r, color.g, color.b])
      ),
      3
    )
  );
  const width = GRID.across + 1;
  geometry.setIndex(
    Arr.flatMap(Arr.range(0, GRID.along - 1), (row) =>
      Arr.flatMap(Arr.range(0, GRID.across - 1), (column) => {
        const a = row * width + column;
        const b = a + width;
        return [a, b, a + 1, b, b + 1, a + 1];
      })
    )
  );
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A painted fishing perahu at anchor off the kampung. It floats, so it
 * rises and heaves with the sea's surface it is drawn on.
 */
export function Boat() {
  const hull = useMemo(hullGeometry, []);
  useEffect(() => () => hull.dispose(), [hull]);
  return (
    <group position={MOORING} rotation={[0, 0.3, 0]}>
      <mesh castShadow geometry={hull} receiveShadow>
        <meshStandardMaterial roughness={0.55} side={DoubleSide} vertexColors />
      </mesh>
      {Arr.map([-0.8, 0.9], (x) => (
        <mesh castShadow key={x} position={[x, 0.35, 0]} receiveShadow>
          <boxGeometry args={[0.24, 0.04, 1.3]} />
          <meshStandardMaterial
            color={ECOLOGY_COLORS.woodPale}
            roughness={0.8}
          />
        </mesh>
      ))}
    </group>
  );
}
