import {
  CELL_WALL,
  CROWN_INDEX,
  lensProfile,
} from "@repo/design-system/components/three/optic/lens";
import {
  GlassMaterial,
  VesselGlassMaterial,
} from "@repo/design-system/components/three/physical";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { Shape, Vector2 } from "three";

/** How many steps turn a lens and its cell about the axis: round at any zoom. */
const TURNS = 96;

/** How deep the cell that holds a lens is along the axis. */
const CELL_DEEP = 0.07;

/** The outline of a lens cell: a turned ring with a seat for the glass, a chamfer on each edge, and a retaining groove. */
function cellProfile(half: number, rim: number) {
  const seat = half - 0.012;
  const out = half + CELL_WALL;
  const deep = Math.max(CELL_DEEP, rim + 0.03) / 2;
  return Arr.map(
    [
      [seat, -deep],
      [out - 0.008, -deep],
      [out, -deep + 0.008],
      [out, -0.012],
      [out - 0.006, -0.006],
      [out - 0.006, 0.006],
      [out, 0.012],
      [out, deep - 0.008],
      [out - 0.008, deep],
      [seat, deep],
      [seat, rim / 2],
      [half + 0.002, rim / 2],
      [half + 0.002, -rim / 2],
      [seat, -rim / 2],
      [seat, -deep],
    ] as const,
    ([radius, along]) => new Vector2(radius, along)
  );
}

/**
 * A real spherical lens in its cell, standing across the optical axis, which
 * runs along x through its middle. Its two faces are ground to the radius
 * the lensmaker's equation gives for its focal length, so a strong lens is
 * visibly fatter than a weak one, and its rim is the flat ground band a
 * real lens is held by. On a desktop the glass refracts what stands behind
 * it. The cell is a black anodised ring that reaches `drop` below the axis,
 * where a carrier's post takes it.
 *
 * @param focal - The focal length, in scene units, positive for a converging lens
 * @param half - Half the width of the lens across its rim
 * @param thin - The thickness of the glass where it is thinnest
 */
export function Lens({
  focal,
  half,
  thin = 0.03,
}: {
  readonly focal: number;
  readonly half: number;
  readonly thin?: number;
}) {
  const glass = useMemo(() => {
    const lens = lensProfile({ focal, half, index: CROWN_INDEX, thin });
    return {
      cell: cellProfile(lens.half, Math.min(thin, lens.thickness)),
      half: lens.half,
      points: Arr.map(
        lens.points,
        ([radius, along]) => new Vector2(Math.max(radius, 0.0004), along)
      ),
      thickness: lens.thickness,
    };
  }, [focal, half, thin]);

  return (
    <group rotation={[0, 0, -Math.PI / 2]}>
      <mesh renderOrder={4}>
        <latheGeometry args={[glass.points, TURNS]} />
        <VesselGlassMaterial
          color={BENCH_COLORS.glass}
          thickness={glass.thickness}
          tint={BENCH_COLORS.glassEdge}
        />
      </mesh>
      <mesh castShadow receiveShadow>
        <latheGeometry args={[glass.cell, TURNS]} />
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.anodised}
          metalness={1}
          repeat={[12, 1]}
          roughness={0.38}
          surface="brushed"
        />
      </mesh>
      <mesh castShadow position={[glass.half + CELL_WALL + 0.03, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.07, 24]} />
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.anodised}
          metalness={1}
          repeat={[2, 1]}
          roughness={0.38}
          surface="brushed"
        />
      </mesh>
    </group>
  );
}

/**
 * A rectangular block of polished glass lying on the bench, `wide` along x,
 * `deep` along z and `tall` high, centred on the origin with its base on the
 * floor of its group. Its edges are the small ground chamfers a real block
 * has, which catch the light, and its long faces are polished clear, so a
 * beam inside it shows.
 *
 * @param wide - The length of the block along x
 * @param deep - The length of the block along z
 * @param tall - The thickness of the block
 */
export function Slab({
  deep,
  tall,
  wide,
}: {
  readonly deep: number;
  readonly tall: number;
  readonly wide: number;
}) {
  const chamfer = Math.min(tall, deep, wide) * 0.045;
  const outline = useMemo(() => {
    const shape = new Shape();
    const x = wide / 2 - chamfer;
    const z = deep / 2 - chamfer;
    shape.moveTo(-x, -z);
    shape.lineTo(x, -z);
    shape.lineTo(x, z);
    shape.lineTo(-x, z);
    shape.closePath();
    return shape;
  }, [chamfer, deep, wide]);

  return (
    <group position={[0, chamfer + 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh renderOrder={4}>
        <extrudeGeometry
          args={[
            outline,
            {
              bevelEnabled: true,
              bevelSegments: 3,
              bevelSize: chamfer,
              bevelThickness: chamfer,
              depth: tall - 2 * chamfer,
            },
          ]}
        />
        <GlassMaterial color={BENCH_COLORS.glassEdge} opacity={0.2} />
      </mesh>
    </group>
  );
}
