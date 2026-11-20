import { NEURON_COLORS } from "@repo/design-system/lib/material/neuron";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import type { Curve, Plane, Side } from "three";
import {
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  FrontSide,
  MeshPhysicalMaterial,
  Vector3,
} from "three";

/** The radius of a swept tube at `along` (0 to 1 down the tube) and `angle` round it. */
type Radius = (along: number, angle: number) => number;

/** The colour of a swept tube's skin at `along` and `angle`, as linear RGB from 0 to 1. */
type Tint = (along: number, angle: number) => readonly [number, number, number];

/**
 * A tube swept along the stretch of `curve` from `from` to `to` (shares of
 * its length), `rings` rings long and `sides` sides round, whose radius may
 * swell, taper and close at either end. Its frame turns as little as the
 * curve lets it (parallel transport), starting with its first normal as near
 * the world's up as it can be, so angle 0 faces up wherever the tube runs.
 */
export function sweep({
  curve,
  from = 0,
  radius,
  rings,
  sides,
  tint,
  to = 1,
}: {
  readonly curve: Curve<Vector3>;
  readonly from?: number;
  readonly radius: Radius;
  readonly rings: number;
  readonly sides: number;
  readonly tint?: Tint;
  readonly to?: number;
}) {
  const count = (rings + 1) * (sides + 1);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const indices = new Uint32Array(rings * sides * 6);
  const point = new Vector3();
  const tangent = new Vector3();
  const normal = new Vector3(0, 1, 0);
  const binormal = new Vector3();
  const offset = new Vector3();

  for (const ring of Arr.range(0, rings)) {
    const along = ring / rings;
    const share = from + (to - from) * along;
    curve.getPointAt(share, point);
    curve.getTangentAt(share, tangent);
    if (ring === 0 && Math.abs(tangent.y) > 0.95) {
      normal.set(0, 0, 1);
    }
    // Parallel transport: drop the part of the last normal along the tangent.
    normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
    binormal.crossVectors(tangent, normal);
    for (const side of Arr.range(0, sides)) {
      const angle = (side / sides) * Math.PI * 2;
      const size = radius(along, angle);
      const vertex = ring * (sides + 1) + side;
      offset
        .copy(normal)
        .multiplyScalar(Math.cos(angle) * size)
        .addScaledVector(binormal, Math.sin(angle) * size)
        .add(point);
      positions.set([offset.x, offset.y, offset.z], vertex * 3);
      uvs.set([along, side / sides], vertex * 2);
      colors.set(
        tint === undefined ? [1, 1, 1] : tint(along, angle),
        vertex * 3
      );
    }
  }

  for (const ring of Arr.range(0, rings - 1)) {
    for (const side of Arr.range(0, sides - 1)) {
      const a = ring * (sides + 1) + side;
      const b = a + sides + 1;
      indices.set([a, a + 1, b, b, a + 1, b + 1], (ring * sides + side) * 6);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A radius that holds `size` and rounds off to a closed tip over the last
 * `round` of the tube, as a dendrite or a twig ends.
 */
export function rounded(size: number, round: number, along: number) {
  const tip = Math.max(0, along - (1 - round)) / round;
  return size * Math.sqrt(Math.max(0, 1 - tip * tip));
}

/** Disposes `geometry` when it is replaced or the scene unmounts. */
export function useOwned<T extends { dispose: () => void }>(owned: T) {
  useEffect(() => () => owned.dispose(), [owned]);
  return owned;
}

/**
 * Living tissue: a soft, moist skin that scatters a little light at grazing
 * angles (sheen) under a faint wet clear coat, so membranes read as
 * membranes and not as plastic. With `tinted`, the skin takes its colour from
 * the geometry's vertex colours, times `color` when one is given; with
 * `clip`, the planes cut it open; below an `opacity` of 1 it lets what lies
 * inside show through.
 */
export function TissueMaterial({
  clip,
  color,
  coat = 0.35,
  opacity = 1,
  roughness = 0.55,
  sheen = NEURON_COLORS.membraneSheen,
  side = FrontSide,
  tinted = false,
}: {
  readonly clip?: readonly Plane[];
  readonly coat?: number;
  readonly color?: string;
  readonly opacity?: number;
  readonly roughness?: number;
  readonly sheen?: string;
  readonly side?: Side;
  readonly tinted?: boolean;
}) {
  // Sheen and clipping planes are set on the material object, which JSX props cannot name.
  const material = useMemo(
    () =>
      new MeshPhysicalMaterial({
        clearcoat: coat,
        clearcoatRoughness: 0.45,
        clippingPlanes: clip === undefined ? null : [...clip],
        ...(color === undefined ? {} : { color }),
        depthWrite: opacity >= 1,
        opacity,
        roughness,
        sheen: 0.7,
        sheenColor: sheen,
        sheenRoughness: 0.55,
        side,
        transparent: opacity < 1,
        vertexColors: tinted,
      }),
    [clip, coat, color, opacity, roughness, sheen, side, tinted]
  );
  useOwned(material);
  return <primitive attach="material" object={material} />;
}
