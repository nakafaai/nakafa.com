import type { Point } from "@repo/design-system/components/contents/biology/capillary/bed";
import { curve } from "@repo/design-system/components/contents/biology/capillary/bed";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import type { Plane, Side } from "three";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  FrontSide,
  MeshPhysicalMaterial,
  Vector3,
} from "three";

/** The vertical, which the vessels' frames are squared against so their surfaces never twist. */
const UP = new Vector3(0, 1, 0);

/**
 * A vessel's axis sampled at even steps of length: at each step its centre,
 * its direction, the sideways and the upward direction across it, and its
 * radius. A vessel that rests on the tissue floor has its centre lifted by
 * its own radius, so it touches the floor all along however it narrows.
 */
export type Axis = ReturnType<typeof sampleAxis>;

/** Samples the axis of a vessel through `path` with `radius` along it, once. */
export function useAxis(
  path: readonly Point[],
  radius: (share: number) => number,
  steps: number,
  rest: boolean
) {
  return useMemo(
    () => sampleAxis(path, radius, steps, rest),
    [path, radius, steps, rest]
  );
}

/** Samples the axis of a vessel through `path` with `radius` along it. */
function sampleAxis(
  path: readonly Point[],
  radius: (share: number) => number,
  steps: number,
  rest: boolean
) {
  const line = curve(path);
  const centre = new Float32Array((steps + 1) * 3);
  const tangent = new Float32Array((steps + 1) * 3);
  const across = new Float32Array((steps + 1) * 3);
  const up = new Float32Array((steps + 1) * 3);
  const radii = new Float32Array(steps + 1);
  const point = new Vector3();
  const direction = new Vector3();
  const side = new Vector3();
  const lift = new Vector3();
  for (const step of Arr.range(0, steps)) {
    const share = step / steps;
    const size = radius(share);
    line.getPointAt(share, point);
    line.getTangentAt(share, direction);
    if (rest) {
      point.y = size;
      direction.y = 0;
      direction.normalize();
    }
    side.crossVectors(direction, UP).normalize();
    lift.crossVectors(side, direction).normalize();
    point.toArray(centre, step * 3);
    direction.toArray(tangent, step * 3);
    side.toArray(across, step * 3);
    lift.toArray(up, step * 3);
    radii[step] = size;
  }
  return {
    across,
    centre,
    length: line.getLength(),
    radius: radii,
    steps,
    tangent,
    up,
  };
}

/**
 * Writes the point of `axis` at a share `along` it, `out` from the axis and
 * turned `angle` from straight up, into `target`. The nearest sample stands
 * in for the exact one, which is finer than a red cell.
 */
export function pointOn(
  axis: Axis,
  along: number,
  out: number,
  angle: number,
  target: Vector3
) {
  const step = Math.round(Math.min(1, Math.max(0, along)) * axis.steps) * 3;
  const sin = Math.sin(angle) * out;
  const cos = Math.cos(angle) * out;
  return target.set(
    axis.centre[step] + axis.across[step] * sin + axis.up[step] * cos,
    axis.centre[step + 1] +
      axis.across[step + 1] * sin +
      axis.up[step + 1] * cos,
    axis.centre[step + 2] +
      axis.across[step + 2] * sin +
      axis.up[step + 2] * cos
  );
}

/** Writes the direction of `axis` at a share `along` it into `target`. */
export function directionOn(axis: Axis, along: number, target: Vector3) {
  const step = Math.round(Math.min(1, Math.max(0, along)) * axis.steps) * 3;
  return target.fromArray(axis.tangent, step);
}

/** The radius of `axis` at a share `along` it. */
export function radiusOn(axis: Axis, along: number) {
  return axis.radius[Math.round(Math.min(1, Math.max(0, along)) * axis.steps)];
}

/**
 * The surface of a vessel round `axis`, `radial` vertices about, from the
 * share `from` to `to` of its length. `shape` gives, for a point of the
 * surface at a distance `run` along the vessel and turned `angle` from
 * straight up, how far it lifts off the plain tube and how much of `accent`
 * tints its colour over `base`. `scale` sets the radius, so the same axis
 * draws both the outer wall and the lumen.
 */
export function useSweep({
  accent,
  axis,
  base,
  from = 0,
  radial,
  scale = 1,
  shape,
  to = 1,
}: {
  readonly accent: string;
  readonly axis: Axis;
  readonly base: string;
  readonly from?: number;
  readonly radial: number;
  readonly scale?: number;
  readonly shape: (
    run: number,
    angle: number,
    radius: number
  ) => readonly [number, number];
  readonly to?: number;
}) {
  const geometry = useMemo(() => {
    const first = Math.round(from * axis.steps);
    const last = Math.round(to * axis.steps);
    const rings = last - first + 1;
    const positions = new Float32Array(rings * (radial + 1) * 3);
    const colors = new Float32Array(rings * (radial + 1) * 3);
    const plain = new Color(base);
    const tint = new Color(accent);
    const mixed = new Color();
    const point = new Vector3();
    for (const ring of Arr.range(0, rings - 1)) {
      const along = (first + ring) / axis.steps;
      const radius = radiusOn(axis, along) * scale;
      for (const turn of Arr.range(0, radial)) {
        const angle = (turn / radial) * Math.PI * 2;
        const [lift, amount] = shape(along * axis.length, angle, radius);
        pointOn(axis, along, radius + lift, angle, point);
        const index = ring * (radial + 1) + turn;
        point.toArray(positions, index * 3);
        mixed.copy(plain).lerp(tint, Math.min(1, Math.max(0, amount)));
        mixed.toArray(colors, index * 3);
      }
    }
    const indices = Arr.flatMap(Arr.range(0, rings - 2), (ring) =>
      Arr.flatMap(Arr.range(0, radial - 1), (turn) => {
        const a = ring * (radial + 1) + turn;
        const b = a + radial + 1;
        return [a, a + 1, b, b, a + 1, b + 1];
      })
    );
    const surface = new BufferGeometry();
    surface.setAttribute("position", new BufferAttribute(positions, 3));
    surface.setAttribute("color", new BufferAttribute(colors, 3));
    surface.setIndex(indices);
    surface.computeVertexNormals();
    // The first and last vertex of each ring meet at the same point: share
    // their normal, or the light shows a seam along the vessel.
    const normals = surface.getAttribute("normal");
    const shared = new Vector3();
    for (const ring of Arr.range(0, rings - 1)) {
      const first = ring * (radial + 1);
      const last = first + radial;
      shared
        .fromBufferAttribute(normals, first)
        .add(point.fromBufferAttribute(normals, last))
        .normalize();
      normals.setXYZ(first, shared.x, shared.y, shared.z);
      normals.setXYZ(last, shared.x, shared.y, shared.z);
    }
    return surface;
  }, [accent, axis, base, from, radial, scale, shape, to]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * A living surface: waxy and soft, with a velvet sheen at grazing angles
 * that lit tissue shows, coloured by its vertices. A translucent one, as a
 * capillary wall one cell thick, lets what is inside show through; `clip`
 * cuts it where the block's faces cut the tissue.
 */
export function useOrganicMaterial({
  clearcoat = 0.35,
  clip,
  opacity = 1,
  roughness = 0.5,
  sheen,
  side = FrontSide,
}: {
  readonly clearcoat?: number;
  readonly clip?: readonly Plane[];
  readonly opacity?: number;
  readonly roughness?: number;
  readonly sheen: string;
  readonly side?: Side;
}) {
  const material = useMemo(
    () =>
      new MeshPhysicalMaterial({
        clearcoat,
        clearcoatRoughness: 0.35,
        clippingPlanes: clip === undefined ? null : [...clip],
        depthWrite: opacity >= 1,
        opacity,
        roughness,
        sheen: 0.6,
        sheenColor: new Color(sheen),
        sheenRoughness: 0.45,
        side: opacity < 1 ? DoubleSide : side,
        transparent: opacity < 1,
        vertexColors: true,
      }),
    [clearcoat, clip, opacity, roughness, sheen, side]
  );
  useEffect(() => () => material.dispose(), [material]);
  return material;
}
