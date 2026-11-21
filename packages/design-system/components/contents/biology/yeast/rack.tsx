import { YEAST_COLORS } from "@repo/design-system/lib/material/yeast";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { ExtrudeGeometry, Path, Shape } from "three";

/** A rectangle with rounded corners, centred on the origin, for an extruded slab. */
function roundedRectangle(width: number, depth: number, corner: number) {
  const x = width / 2;
  const y = depth / 2;
  return new Shape()
    .moveTo(-x + corner, -y)
    .lineTo(x - corner, -y)
    .quadraticCurveTo(x, -y, x, -y + corner)
    .lineTo(x, y - corner)
    .quadraticCurveTo(x, y, x - corner, y)
    .lineTo(-x + corner, y)
    .quadraticCurveTo(-x, y, -x, y - corner)
    .lineTo(-x, -y + corner)
    .quadraticCurveTo(-x, -y, -x + corner, -y);
}

/** A slab of `shape` `height` thick lying flat on the bench, its edges bevelled. */
function useSlab(shape: Shape, height: number) {
  const geometry = useMemo(() => {
    const bevel = Math.min(0.002, height / 4);
    const slab = new ExtrudeGeometry(shape, {
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: bevel,
      bevelThickness: bevel,
      curveSegments: 10,
      depth: height - 2 * bevel,
    });
    slab.rotateX(-Math.PI / 2);
    slab.translate(0, bevel, 0);
    return slab;
  }, [height, shape]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** A wooden test-tube rack: a base, two end posts, and a top board bored for three tubes, in metres. */
const RACK = {
  depth: 0.046,
  height: 0.075,
  hole: 0.0095,
  width: 0.1,
} as const;

/** Where each hole of the rack stands along its length, in metres. */
const RACK_HOLES = [-0.03, 0, 0.03] as const;

/**
 * A varnished wooden rack standing at the origin, its three holes along x;
 * a tube stood in the middle hole, over the origin, rests its foot on the
 * base board.
 */
export function Rack() {
  const boards = useMemo(() => {
    const base = roundedRectangle(RACK.width, RACK.depth, 0.004);
    const top = roundedRectangle(RACK.width, RACK.depth * 0.8, 0.004);
    top.holes = Arr.map(RACK_HOLES, (x) =>
      new Path().absarc(x, 0, RACK.hole, 0, Math.PI * 2, true)
    );
    return { base, top };
  }, []);
  const base = useSlab(boards.base, 0.01);
  const top = useSlab(boards.top, 0.008);
  return (
    <group>
      <mesh castShadow geometry={base} receiveShadow>
        <meshPhysicalMaterial
          clearcoat={0.25}
          clearcoatRoughness={0.5}
          color={YEAST_COLORS.rack}
          roughness={0.62}
        />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <mesh
          castShadow
          key={side}
          position={[
            side * (RACK.width / 2 - 0.004),
            0.01 + (RACK.height - 0.01) / 2,
            0,
          ]}
        >
          <boxGeometry args={[0.008, RACK.height - 0.01, RACK.depth * 0.8]} />
          <meshPhysicalMaterial
            clearcoat={0.25}
            color={YEAST_COLORS.rackEnd}
            roughness={0.62}
          />
        </mesh>
      ))}
      <mesh castShadow geometry={top} position={[0, RACK.height - 0.008, 0]}>
        <meshPhysicalMaterial
          clearcoat={0.25}
          clearcoatRoughness={0.5}
          color={YEAST_COLORS.rack}
          roughness={0.62}
        />
      </mesh>
    </group>
  );
}

/** The rack's base board, in metres: a tube in it stands this high. */
export const RACK_FLOOR = 0.01;

/** The front of the rack and the top of its top board, in metres: where a word can name what stands in it. */
export const RACK_FRONT = RACK.depth / 2;
export const RACK_TOP = RACK.height;
