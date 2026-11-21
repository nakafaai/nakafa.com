import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  MeshPhysicalMaterial,
  Vector3,
} from "three";

/** A point of an outline in its own plane: across, then up. */
type Pair = readonly [number, number];

/** How a membrane is swept from its outline: turned half round its axis, or drawn along x. */
type Sweep = "lathe" | "along";

/**
 * Where the head groups and the fatty tails lie across a cut bilayer, from
 * its outer face to its inner one: a head layer of about 1 nm on each side
 * of the 3 nm core of tails (Alberts et al., Molecular Biology of the Cell
 * 6e, Ch. 10), drawn as two bands of each so the bands stay sharp.
 */
const LAYERS = [
  [0, "head"],
  [0.2, "head"],
  [0.2, "tail"],
  [0.8, "tail"],
  [0.8, "head"],
  [1, "head"],
] as const;

/** The outward normal of an outline at each of its points, from its neighbours. */
function normals(outline: readonly Pair[]) {
  return Arr.map(outline, (point, index) => {
    const before = outline[Math.max(0, index - 1)] ?? point;
    const after = outline[Math.min(outline.length - 1, index + 1)] ?? point;
    const across = after[0] - before[0];
    const up = after[1] - before[1];
    const length = Math.hypot(across, up) || 1;
    return [up / length, -across / length] as const;
  });
}

/** The triangles of a grid of `rows` by `columns` vertices laid row after row from `offset`. */
function grid(rows: number, columns: number, offset = 0) {
  return Arr.flatMap(Arr.range(0, rows - 2), (row) =>
    Arr.flatMap(Arr.range(0, columns - 2), (column) => {
      const a = offset + row * columns + column;
      const b = a + columns;
      return [a, b, a + 1, b, b + 1, a + 1];
    })
  );
}

/**
 * The surfaces of one cut membrane: its outer face, its inner face a bilayer
 * deeper, and the cut edge between them, coloured head, tail, head. A lathe
 * turns the outline from x = r round the back to x = -r, so it is cut where
 * z is 0 at its first and last turn; an outline drawn along x is a section
 * in depth and height, cut along its first and last point. Both faces are
 * lifted and sunk alike by smooth noise, softened where `calm` says the
 * membrane must stay true, such as at the cleft.
 */
export function useMembrane({
  calm,
  head,
  length = 0,
  outline,
  seed,
  sweep,
  tail,
  thickness,
  turns = 96,
  wave = 0.5,
}: {
  readonly calm: (point: Vector3) => number;
  readonly head: string;
  readonly length?: number;
  readonly outline: readonly Pair[];
  readonly seed: number;
  readonly sweep: Sweep;
  readonly tail: string;
  readonly thickness: number;
  readonly turns?: number;
  readonly wave?: number;
}) {
  const built = useMemo(() => {
    const outward = normals(outline);
    const point = new Vector3();
    const facing = new Vector3();
    const corner = new Vector3();
    const place = (row: number, column: number, depth: number) => {
      const [across, up] = outline[row] ?? [0, 0];
      const [nAcross, nUp] = outward[row] ?? [0, 1];
      const share = column / turns;
      if (sweep === "lathe") {
        const angle = Math.PI / 2 + share * Math.PI;
        facing.set(nAcross * Math.sin(angle), nUp, nAcross * Math.cos(angle));
        point.set(across * Math.sin(angle), up, across * Math.cos(angle));
      } else {
        facing.set(0, nUp, nAcross);
        point.set(-length + 2 * length * share, up, across);
      }
      const lift =
        wave *
        calm(point) *
        (valueNoise(point.x / 9 + seed, point.y / 9 + point.z / 7, 64) -
          0.5 +
          0.35 *
            (valueNoise(point.x / 3.5 - seed, point.z / 3.5 + point.y / 5, 64) -
              0.5));
      return corner
        .copy(point)
        .addScaledVector(facing, lift - depth)
        .toArray();
    };
    const face = (depth: number) => {
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        "position",
        new Float32BufferAttribute(
          Arr.flatMap(Arr.range(0, outline.length - 1), (row) =>
            Arr.flatMap(Arr.range(0, turns), (column) =>
              place(row, column, depth)
            )
          ),
          3
        )
      );
      geometry.setIndex(grid(outline.length, turns + 1));
      geometry.computeVertexNormals();
      return geometry;
    };
    // The cut runs along the outline at the first and last turn of a lathe,
    // and along x at the first and last point of a section.
    const cuts: readonly (readonly (readonly [number, number])[])[] =
      sweep === "lathe"
        ? Arr.map([0, turns], (column) =>
            Arr.map(
              Arr.range(0, outline.length - 1),
              (row) => [row, column] as const
            )
          )
        : Arr.map([0, outline.length - 1], (row) =>
            Arr.map(Arr.range(0, turns), (column) => [row, column] as const)
          );
    const tones = { head: new Color(head), tail: new Color(tail) };
    const rim = new BufferGeometry();
    rim.setAttribute(
      "position",
      new Float32BufferAttribute(
        Arr.flatMap(cuts, (cut) =>
          Arr.flatMap(cut, ([row, column]) =>
            Arr.flatMap(LAYERS, ([depth]) =>
              place(row, column, depth * thickness)
            )
          )
        ),
        3
      )
    );
    rim.setAttribute(
      "color",
      new Float32BufferAttribute(
        Arr.flatMap(cuts, (cut) =>
          Arr.flatMap(cut, () =>
            Arr.flatMap(LAYERS, ([, layer]) => tones[layer].toArray())
          )
        ),
        3
      )
    );
    rim.setIndex(
      Arr.flatMap(cuts, (cut, index) =>
        grid(cut.length, LAYERS.length, index * cut.length * LAYERS.length)
      )
    );
    rim.computeVertexNormals();
    return { inner: face(thickness), outer: face(0), rim };
  }, [calm, head, length, outline, seed, sweep, tail, thickness, turns, wave]);

  useEffect(
    () => () => {
      built.inner.dispose();
      built.outer.dispose();
      built.rim.dispose();
    },
    [built]
  );
  return built;
}

/**
 * The living membrane of a cell: a waxy lipid surface with a soft sheen at
 * grazing angles, as light scatters in the outer leaflet of a medical
 * render, and a faint clear coat. The part that owns it may light it from
 * within, as an impulse depolarises it.
 */
export function useMembraneMaterial(
  color: string,
  sheen: string,
  roughness = 0.5,
  glow = sheen
) {
  // Sheen is set on the material object, which JSX props cannot name.
  const material = useMemo(
    () =>
      new MeshPhysicalMaterial({
        clearcoat: 0.35,
        clearcoatRoughness: 0.5,
        color,
        emissive: new Color(glow),
        emissiveIntensity: 0,
        roughness,
        sheen: 0.8,
        sheenColor: new Color(sheen),
        sheenRoughness: 0.45,
        side: DoubleSide,
      }),
    [color, glow, roughness, sheen]
  );
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

/**
 * One cut membrane: its outer and inner faces in their own materials and the
 * bilayer showing along the cut.
 */
export function Membrane({
  geometry,
  inner,
  outer,
}: {
  readonly geometry: ReturnType<typeof useMembrane>;
  readonly inner: MeshPhysicalMaterial;
  readonly outer: MeshPhysicalMaterial;
}) {
  return (
    <group>
      <mesh
        castShadow
        geometry={geometry.outer}
        material={outer}
        receiveShadow
      />
      <mesh geometry={geometry.inner} material={inner} receiveShadow />
      <mesh geometry={geometry.rim}>
        <meshStandardMaterial roughness={0.55} side={DoubleSide} vertexColors />
      </mesh>
    </group>
  );
}
