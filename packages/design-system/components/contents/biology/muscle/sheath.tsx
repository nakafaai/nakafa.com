import { useFrame } from "@react-three/fiber";
import {
  FRONT,
  hull,
} from "@repo/design-system/components/contents/biology/muscle/bundle";
import { usePose } from "@repo/design-system/components/contents/biology/muscle/pose";
import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import { MUSCLE_COLORS } from "@repo/design-system/lib/material/muscle";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  MeshPhysicalMaterial,
} from "three";

/**
 * Where the perimysium is cut away to open the fascicle to view, as angles
 * round its axis from the top towards the front: it stays from the lower
 * front, round the bottom and the back, to just behind the top.
 */
const OPEN = { from: (105 * Math.PI) / 180, to: (345 * Math.PI) / 180 };

/** How far the sheath stands off the fibres and how thick it is drawn, in scene units (2 and 4 µm). */
const SHEET = { clear: 0.2, thick: 0.4 } as const;

/** How far short of the fibres' cut the sheath is trimmed, so the layers read one under another, in scene units. */
const TRIM = 3.2;

/** Points across the sheath's width and rings along it. */
const ACROSS = 72;
const ALONG = 48;

/**
 * The perimysium's sheet as an indexed mesh: its outer and inner faces, the
 * two long cut edges, and the two trimmed ends, each with its own vertices so
 * the edges stay crisp, and a faint fibrous shade baked in as colour.
 */
function buildSheath() {
  const back = -FRONT;
  const front = FRONT - TRIM;
  // The cut edges wander a little, as a sheet cut and peeled back by hand does.
  const wander = (x: number, seed: number) =>
    valueNoise(x * 0.22 + seed, seed, 64) - 0.5;
  const point = (step: number, ring: number, outer: boolean) => {
    const share = step / ACROSS;
    const along = back + ((front - back) * ring) / ALONG;
    const from = OPEN.from + 0.12 * wander(along, 3);
    const to = OPEN.to + 0.12 * wander(along, 11);
    const angle = from + (to - from) * share;
    const end = ring === ALONG ? 1.1 * wander(angle * 4, 19) : 0;
    const radius = hull(angle) + SHEET.clear + (outer ? SHEET.thick : 0);
    return [along + end, Math.cos(angle) * radius, Math.sin(angle) * radius];
  };
  const pale = new Color(MUSCLE_COLORS.collagen);
  const shade = (x: number, y: number) => {
    const grain =
      0.5 * valueNoise(x * 0.35, y * 3.1, 64) +
      0.5 * valueNoise(x * 1.4 + 9, y * 9.7, 64);
    return 0.86 + 0.18 * grain;
  };
  // A grid of `rows` × `columns` vertices from `place`, joined into quads facing `outward`.
  const sheet = (
    rows: number,
    columns: number,
    place: (row: number, column: number) => readonly number[],
    outward: boolean
  ) => {
    const cells = Arr.flatMap(Arr.range(0, rows - 1), (row) =>
      Arr.map(Arr.range(0, columns - 1), (column) => {
        const spot = place(row, column);
        const lift = shade(Arr.getUnsafe(spot, 0), (row + column * 0.37) / 6);
        return { lift, spot };
      })
    );
    const indices = Arr.flatMap(Arr.range(0, rows - 2), (row) =>
      Arr.flatMap(Arr.range(0, columns - 2), (column) => {
        const a = row * columns + column;
        const b = a + 1;
        const c = a + columns;
        const d = c + 1;
        return outward ? [a, c, b, b, c, d] : [a, b, c, b, d, c];
      })
    );
    return {
      colours: Arr.flatMap(cells, ({ lift }) => [
        pale.r * lift,
        pale.g * lift,
        pale.b * lift,
      ]),
      indices,
      positions: Arr.flatMap(cells, ({ spot }) => spot),
    };
  };
  const sheets = [
    sheet(ALONG + 1, ACROSS + 1, (ring, step) => point(step, ring, true), true),
    sheet(
      ALONG + 1,
      ACROSS + 1,
      (ring, step) => point(step, ring, false),
      false
    ),
    sheet(ALONG + 1, 2, (ring, side) => point(0, ring, side === 1), false),
    sheet(ALONG + 1, 2, (ring, side) => point(ACROSS, ring, side === 1), true),
    sheet(2, ACROSS + 1, (side, step) => point(step, ALONG, side === 0), true),
    sheet(2, ACROSS + 1, (side, step) => point(step, 0, side === 0), false),
  ];
  // Where each sheet's vertices start in the shared buffer.
  const starts = Arr.scan(
    sheets,
    0,
    (start, { positions }) => start + positions.length / 3
  );
  const positions = Arr.flatMap(sheets, (part) => part.positions);
  const colours = Arr.flatMap(sheets, (part) => part.colours);
  const indices = Arr.flatMap(Arr.zip(sheets, starts), ([part, start]) =>
    Arr.map(part.indices, (index) => index + start)
  );
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The perimysium: the sheet of collagen that wraps the fascicle, cut open
 * over the top and front and trimmed back from the fibres' cut, so the
 * fibres show inside it. It shortens and swells with them.
 */
export function Sheath() {
  const pose = usePose();
  const group = useRef<Group>(null);
  const geometry = useMemo(buildSheath, []);
  const material = useMemo(
    () =>
      // Sheen and its colour are set on the material object, which JSX props cannot name.
      new MeshPhysicalMaterial({
        clearcoat: 0.5,
        clearcoatRoughness: 0.35,
        roughness: 0.62,
        sheen: 0.8,
        sheenColor: new Color(MUSCLE_COLORS.collagen),
        sheenRoughness: 0.4,
        side: DoubleSide,
        vertexColors: true,
      }),
    []
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  useFrame(() => {
    const now = pose.current;
    group.current?.position.setX(now.shift);
    group.current?.scale.set(now.stretch, now.swell, now.swell);
  });

  return (
    <group ref={group}>
      <mesh castShadow geometry={geometry} material={material} receiveShadow />
    </group>
  );
}
