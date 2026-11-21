import type { Plant } from "@repo/design-system/components/contents/biology/paddy/oxygen";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { PADDY_COLORS } from "@repo/design-system/lib/material/paddy";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  MeshPhysicalMaterial,
  Quaternion,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** The world's up, which leaves droop away from. */
const UP = new Vector3(0, 1, 0);

/** A number eased from 0 at `from` to 1 at `to`. */
function ease(from: number, to: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/**
 * One leaf blade as a strip folded along its midrib: it leaves `base` toward
 * `heading` at `rise` above the horizontal, droops by `droop` of its length
 * at the tip, is `width` across at its widest, and tapers to a point. Its
 * colour runs from `sheath` at the collar through `leaf` to `tip`, with a
 * paler midrib for maize. `wave` ripples the margins, as a maize leaf's are.
 */
function bladeGeometry(
  base: Vector3,
  heading: number,
  rise: number,
  length: number,
  width: number,
  droop: number,
  wave: number,
  segments: number,
  shades: readonly [sheath: Color, leaf: Color, tip: Color, midrib: Color]
) {
  const [sheath, leaf, tip, midrib] = shades;
  const start = new Vector3(
    Math.cos(rise) * Math.cos(heading),
    Math.sin(rise),
    Math.cos(rise) * Math.sin(heading)
  );
  const along = (s: number) =>
    base
      .clone()
      .addScaledVector(start, length * s)
      .addScaledVector(UP, -droop * length * s ** 2.2);
  const rings = Arr.map(Arr.range(0, segments), (step) => {
    const s = step / segments;
    const here = along(s);
    const tangent = along(Math.min(1, s + 0.01))
      .sub(along(Math.max(0, s - 0.01)))
      .normalize();
    const side = new Vector3().crossVectors(tangent, UP).normalize();
    const facing = new Vector3().crossVectors(side, tangent).normalize();
    const half = (width / 2) * (0.5 + 0.5 * ease(0, 0.14, s)) * (1 - s) ** 0.62;
    const fold = half * 0.32;
    const ripple = wave * half * Math.sin(s * 46) * ease(0.1, 0.4, s);
    const edge = (hand: number) =>
      here
        .clone()
        .addScaledVector(side, hand * half)
        .addScaledVector(facing, fold + ripple * hand);
    const shade = sheath
      .clone()
      .lerp(leaf, ease(0, 0.12, s))
      .lerp(tip, ease(0.82, 1, s));
    const rib = shade.clone().lerp(midrib, 0.55 * (1 - s));
    return [
      [edge(-1), shade],
      [here, rib],
      [edge(1), shade],
    ] as const;
  });
  const points = Arr.flatten(rings);
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(
      new Float32Array(Arr.flatMap(points, ([p]) => [p.x, p.y, p.z])),
      3
    )
  );
  geometry.setAttribute(
    "color",
    new BufferAttribute(
      new Float32Array(Arr.flatMap(points, ([, c]) => [c.r, c.g, c.b])),
      3
    )
  );
  geometry.setIndex(
    Arr.flatMap(Arr.range(0, segments - 1), (step) => {
      const a = step * 3;
      const b = a + 3;
      return [
        a,
        b,
        a + 1,
        a + 1,
        b,
        b + 1,
        a + 1,
        b + 1,
        a + 2,
        a + 2,
        b + 1,
        b + 2,
      ];
    })
  );
  geometry.computeVertexNormals();
  return geometry;
}

/** A tapered stem from `base` along `direction`, painted one colour. */
function stemGeometry(
  base: Vector3,
  direction: Vector3,
  height: number,
  radius: number,
  sides: number,
  color: Color
) {
  const stem = new CylinderGeometry(
    radius * 0.7,
    radius,
    height,
    sides,
    1,
    true
  );
  stem.translate(0, height / 2, 0);
  stem.applyQuaternion(
    new Quaternion().setFromUnitVectors(UP, direction.clone().normalize())
  );
  stem.translate(base.x, base.y, base.z);
  stem.deleteAttribute("uv");
  const count = stem.getAttribute("position").count;
  stem.setAttribute(
    "color",
    new BufferAttribute(
      new Float32Array(
        Arr.flatMap(Arr.range(1, count), () => [color.r, color.g, color.b])
      ),
      3
    )
  );
  return stem.toNonIndexed();
}

/** Leaf shades for one plant, varied a little per leaf by `seed`. */
function shadesOf(plant: Plant, seed: number) {
  const lift = 0.9 + 0.2 * hashUnit(seed, 3);
  const leaf = new Color(
    plant === "rice" ? PADDY_COLORS.riceLeaf : PADDY_COLORS.maizeLeaf
  )
    .lerp(new Color(PADDY_COLORS.riceLeafDeep), hashUnit(seed, 5) * 0.4)
    .multiplyScalar(lift);
  return [
    new Color(
      plant === "rice" ? PADDY_COLORS.riceSheath : PADDY_COLORS.maizeStalk
    ),
    leaf,
    new Color(PADDY_COLORS.riceTip),
    new Color(
      plant === "rice" ? PADDY_COLORS.riceSheath : PADDY_COLORS.maizeMidrib
    ),
  ] as const;
}

/**
 * A hill of transplanted rice at active tillering, about 35 days after
 * transplanting: `tillers` shoots splaying from one clump, each a pale
 * sheath about 15 cm tall carrying three narrow blades, the youngest
 * innermost and most upright. Transplanted rice makes 10 to 30 tillers a
 * hill (EOS crop guide, rice growth stages); blades stand 30 to 40 cm long
 * and about 1 cm wide at this stage, so the hill stands about half a metre
 * over the water.
 */
function riceHill(
  tillers: number,
  blades: number,
  segments: number,
  stems: boolean
) {
  const parts = Arr.flatMap(Arr.range(0, tillers - 1), (tiller) => {
    const around = tiller * 2.399 + hashUnit(tiller, 1) * 0.4;
    const lean = 0.06 + 0.16 * hashUnit(tiller, 2);
    const base = new Vector3(
      Math.cos(around) * 0.012,
      -0.01,
      Math.sin(around) * 0.012
    );
    const direction = new Vector3(
      Math.cos(around) * Math.sin(lean),
      Math.cos(lean),
      Math.sin(around) * Math.sin(lean)
    );
    const height = 0.12 + 0.06 * hashUnit(tiller, 4);
    const collar = base.clone().addScaledVector(direction, height);
    const stem = stemGeometry(
      base,
      direction,
      height,
      0.0032,
      stems ? 8 : 3,
      new Color(PADDY_COLORS.riceSheath)
    );
    const leaves = Arr.map(Arr.range(0, blades - 1), (blade) => {
      const young = blade / Math.max(1, blades - 1);
      const heading =
        around +
        (blade % 2 === 0 ? 0.5 : -0.6) +
        (hashUnit(tiller, blade + 7) - 0.5) * 1.4;
      return bladeGeometry(
        collar.clone().addScaledVector(direction, -0.025 * blade),
        heading,
        1.05 + 0.35 * young + 0.15 * hashUnit(tiller, blade + 9),
        0.28 + 0.12 * hashUnit(tiller, blade + 11) - 0.05 * young,
        0.0095 + 0.003 * hashUnit(tiller, blade + 13),
        0.22 + 0.28 * hashUnit(tiller, blade + 15) - 0.12 * young,
        0,
        segments,
        shadesOf("rice", tiller * 7 + blade)
      ).toNonIndexed();
    });
    return [stem, ...leaves];
  });
  return mergeGeometries(parts);
}

/**
 * Maize at the six-leaf stage (V6): a stalk of rolled sheaths about 2 cm
 * thick, its leaves set on two opposite ranks, each broader and longer than
 * the one below, with a pale midrib and waved margins, and two young leaves
 * still rolled in the whorl at the top.
 */
function maizePlant(leaves: number, segments: number) {
  const stalk = stemGeometry(
    new Vector3(0, -0.01, 0),
    UP,
    0.24,
    0.011,
    10,
    new Color(PADDY_COLORS.maizeStalk)
  );
  const whorl = stemGeometry(
    new Vector3(0, 0.22, 0),
    UP,
    0.12,
    0.007,
    8,
    new Color(PADDY_COLORS.maizeLeaf)
  );
  const blades = Arr.map(Arr.range(0, leaves - 1), (leaf) => {
    const order = leaf / Math.max(1, leaves - 1);
    return bladeGeometry(
      new Vector3(0, 0.03 + 0.035 * leaf, 0),
      (leaf % 2 === 0 ? 0 : Math.PI) +
        leaf * 0.22 +
        (hashUnit(leaf, 21) - 0.5) * 0.3,
      0.95 + 0.25 * order,
      0.14 + 0.42 * order,
      0.03 + 0.045 * order,
      0.55 + 0.25 * hashUnit(leaf, 23),
      0.18,
      segments,
      shadesOf("dryland", leaf)
    ).toNonIndexed();
  });
  return mergeGeometries([stalk, whorl, ...blades]);
}

/** How finely each detail draws a plant: tillers and blades of rice, leaves of maize, and segments a blade. */
const DETAIL = {
  distant: { blades: 2, leaves: 4, segments: 4, tillers: 3 },
  far: { blades: 2, leaves: 5, segments: 5, tillers: 7 },
  near: { blades: 3, leaves: 7, segments: 14, tillers: 16 },
} as const;

/** The shoot of one plant, in full detail over the X-ray zone or plainer far off. */
export function useShoot(plant: Plant, detail: "distant" | "far" | "near") {
  const geometry = useMemo(() => {
    const { blades, leaves, segments, tillers } = DETAIL[detail];
    return plant === "rice"
      ? riceHill(tillers, blades, segments, detail === "near")
      : maizePlant(leaves, segments);
  }, [detail, plant]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * The surface of a living leaf: waxy, with the soft sheen of its cuticle and
 * fine hairs, lit from both faces.
 */
export function useLeafMaterial() {
  const material = useMemo(
    () =>
      new MeshPhysicalMaterial({
        clearcoat: 0.18,
        clearcoatRoughness: 0.45,
        metalness: 0,
        roughness: 0.58,
        sheen: 0.4,
        sheenColor: new Color(PADDY_COLORS.leafSheen),
        sheenRoughness: 0.55,
        side: DoubleSide,
        vertexColors: true,
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);
  return material;
}
