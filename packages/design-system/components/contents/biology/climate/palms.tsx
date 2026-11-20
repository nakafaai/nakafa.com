import { landAt } from "@repo/design-system/components/contents/biology/climate/shore";
import type { Placement } from "@repo/design-system/components/contents/biology/instances";
import { Instances } from "@repo/design-system/components/contents/biology/instances";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { ECOLOGY_COLORS } from "@repo/design-system/lib/material/ecology";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * The coconut palms of the kampung, each `[x, z, size]` in metres, on the dry
 * beach and the grass clear of every house, the boardwalk and the lane,
 * their crowns well above the roofs.
 */
export const GROVE = [
  [3, 17.5, 1],
  [3, 23, 0.92],
  [5, 29, 1.06],
  [13, 33, 1.1],
  [8, 37, 0.95],
  [18, 38, 1.04],
  [24, 34, 0.9],
  [8, -22, 1.05],
  [16, -17, 0.93],
  [5, -31, 1],
  [14, -35, 0.96],
  [22, -27, 1.1],
  [29, -19, 0.97],
  [33, -27, 1.05],
  [38, -4, 1],
] as const;

/** The two trunks the grove is drawn with: nearly straight, and curved far over. */
const FORMS = [
  { height: 9, lean: 0.9 },
  { height: 10.5, lean: 2.6 },
] as const;

/** The radius of a trunk at `t` of its height: a swollen bole, a slim shaft, and a leaf scar ring every 0.35 m. */
function trunkRadius(t: number, height: number) {
  const ring = Math.max(0, Math.sin((t * height * Math.PI * 2) / 0.35)) * 0.008;
  return 0.16 + 0.12 * (1 - t) ** 7 - 0.02 * t + ring;
}

/** A trunk rising from just under the ground and curving `lean` metres toward +x. */
function trunk(height: number, lean: number) {
  const curve = new CatmullRomCurve3(
    Arr.map(Arr.range(0, 4), (step) => {
      const t = step / 4;
      return new Vector3(lean * t ** 1.8, -0.6 + (height + 0.6) * t, 0);
    })
  );
  const rings = 48;
  const sides = 10;
  const tube = new TubeGeometry(curve, rings, 1, sides, false);
  const positions = tube.getAttribute("position");
  const centre = new Vector3();
  const point = new Vector3();
  Arr.forEach(Arr.range(0, rings), (ring) => {
    curve.getPointAt(ring / rings, centre);
    const radius = trunkRadius(ring / rings, height);
    Arr.forEach(Arr.range(0, sides), (side) => {
      const index = ring * (sides + 1) + side;
      point.fromBufferAttribute(positions, index).sub(centre);
      point.multiplyScalar(radius).add(centre);
      positions.setXYZ(index, point.x, point.y, point.z);
    });
  });
  tube.computeVertexNormals();
  return { crown: curve.getPointAt(1), geometry: tube };
}

/**
 * One frond as narrow leaflets hung in a V along an arching rachis: `rise`
 * is how steeply it leaves the crown, `droop` how far its tip sags, and
 * its colour runs from `base` to `tip`.
 */
function frond(
  crown: Vector3,
  heading: number,
  rise: number,
  droop: number,
  length: number,
  base: Color,
  tip: Color
) {
  const start = new Vector3(
    Math.cos(rise) * Math.cos(heading),
    Math.sin(rise),
    Math.cos(rise) * Math.sin(heading)
  );
  const along = (s: number) =>
    crown
      .clone()
      .addScaledVector(start, s)
      .add(new Vector3(0, -droop * (s / length) ** 2, 0));
  const steps = 26;
  const triangles = Arr.flatMap(Arr.range(1, steps), (step) => {
    const s = (step / steps) * length;
    const here = along(s);
    const tangent = along(s + 0.05)
      .sub(here)
      .normalize();
    const side = new Vector3().crossVectors(tangent, new Vector3(0, 1, 0));
    const spread = Math.sin(Math.PI * (0.12 + (0.88 * step) / steps));
    const reach = 1.05 * spread + 0.15;
    const shade = base.clone().lerp(tip, step / steps);
    return Arr.flatMap([1, -1], (hand) => {
      const out = side
        .clone()
        .multiplyScalar(hand * 0.8)
        .add(new Vector3(0, -0.55, 0))
        .addScaledVector(tangent, 0.35)
        .normalize();
      const end = here.clone().addScaledVector(out, reach);
      const back = here.clone().addScaledVector(tangent, -0.07);
      const front = here.clone().addScaledVector(tangent, 0.07);
      return [[back, front, end, shade]] as const;
    });
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(
      new Float32Array(
        Arr.flatMap(triangles, ([a, b, c]) => [
          a.x,
          a.y,
          a.z,
          b.x,
          b.y,
          b.z,
          c.x,
          c.y,
          c.z,
        ])
      ),
      3
    )
  );
  geometry.setAttribute(
    "color",
    new BufferAttribute(
      new Float32Array(
        Arr.flatMap(triangles, ([, , , shade]) =>
          Arr.flatMap(Arr.range(0, 2), () => [shade.r, shade.g, shade.b])
        )
      ),
      3
    )
  );
  geometry.computeVertexNormals();
  return geometry;
}

/** A crown of fifteen living fronds, young ones raised and old ones drooping, over three dead ones hanging down the trunk. */
function crownOf(crown: Vector3, seed: number) {
  const green = new Color(ECOLOGY_COLORS.palmFrond);
  const yellow = new Color(ECOLOGY_COLORS.palmFrondTip);
  const dead = new Color(ECOLOGY_COLORS.palmFrondDead);
  const living = Arr.map(Arr.range(0, 14), (index) => {
    const age = hashUnit(index, seed);
    return frond(
      crown,
      (index / 15) * Math.PI * 2 + age * 0.3,
      0.95 - age * 1.2,
      1.4 + age * 1.6,
      4.2 + hashUnit(seed, index) * 0.8,
      green,
      green.clone().lerp(yellow, 0.35 + age * 0.4)
    );
  });
  const hanging = Arr.map(Arr.range(0, 2), (index) =>
    frond(
      crown.clone().add(new Vector3(0, -0.3, 0)),
      index * 2.1 + seed,
      -1.15,
      0.6,
      3.2,
      dead,
      dead.clone().multiplyScalar(0.8)
    )
  );
  return mergeGeometries([...living, ...hanging]);
}

/** A bunch of coconuts under the crown, round the bud the fronds spring from. */
function nutsOf(crown: Vector3) {
  return mergeGeometries([
    new SphereGeometry(0.32, 12, 8).translate(crown.x, crown.y + 0.05, crown.z),
    ...Arr.map(Arr.range(0, 7), (index) => {
      const turn = (index / 8) * Math.PI * 2;
      return new SphereGeometry(0.15, 10, 8).translate(
        crown.x + Math.cos(turn) * 0.3,
        crown.y - 0.32 - (index % 2) * 0.16,
        crown.z + Math.sin(turn) * 0.3
      );
    }),
  ]);
}

/** One form of palm: its trunk, its fronds and its coconuts. */
function usePalm(height: number, lean: number, seed: number) {
  const parts = useMemo(() => {
    const stem = trunk(height, lean);
    return {
      fronds: crownOf(stem.crown, seed),
      nuts: nutsOf(stem.crown),
      trunk: stem.geometry,
    };
  }, [height, lean, seed]);
  useEffect(
    () => () => {
      parts.fronds.dispose();
      parts.nuts.dispose();
      parts.trunk.dispose();
    },
    [parts]
  );
  return parts;
}

/** The palms drawn in one form, leaning seaward a little to either side. */
function Grove({
  form,
  placements,
}: {
  readonly form: number;
  readonly placements: readonly Placement[];
}) {
  const shape = FORMS[form] ?? FORMS[0];
  const parts = usePalm(shape.height, shape.lean, form + 3);
  return (
    <>
      <Instances placements={placements}>
        <primitive attach="geometry" object={parts.trunk} />
        <meshStandardMaterial
          color={ECOLOGY_COLORS.palmTrunk}
          roughness={0.95}
        />
      </Instances>
      <Instances placements={placements}>
        <primitive attach="geometry" object={parts.fronds} />
        <meshStandardMaterial roughness={0.72} side={DoubleSide} vertexColors />
      </Instances>
      <Instances placements={placements}>
        <primitive attach="geometry" object={parts.nuts} />
        <meshStandardMaterial color={ECOLOGY_COLORS.coconut} roughness={0.6} />
      </Instances>
    </>
  );
}

/** Coconut palms through the kampung, in two forms, each turned and sized on its own. */
export function Palms() {
  const placed = Arr.map(GROVE, ([x, z, size], index) => ({
    form: index % 2,
    placement: {
      position: [x, landAt(x, z), z],
      rotation: [0, Math.PI + (hashUnit(index, 31) - 0.5) * 1.6, 0],
      scale: [size, size, size],
    } satisfies Placement,
  }));
  return (
    <>
      {Arr.map(FORMS, (shape, form) => (
        <Grove
          form={form}
          key={shape.height}
          placements={Arr.map(
            Arr.filter(placed, (palm) => palm.form === form),
            (palm) => palm.placement
          )}
        />
      ))}
    </>
  );
}
