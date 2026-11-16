import {
  type Colony,
  TissueMaterial,
  useTissuePaint,
} from "@repo/design-system/components/contents/biology/climate/coral";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { BufferAttribute, LatheGeometry, MathUtils, Vector2 } from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Points across the underside and across the top of the disc, and steps round it. */
const UNDER = 14;
const TOP = 60;
const AROUND = 576;

/** The primary septa radiating from the mouth; as many secondaries lie between them. */
const SEPTA = 48;

/**
 * The disc's shape for its radius: how high its centre domes above its rim,
 * how thick its rim stands, how high its concave underside arches, and how
 * tall a primary septum stands, in metres.
 */
const DISC = { arch: 0.0032, dome: 0.016, rim: 0.0034, septum: 0.0017 };

/**
 * A ridge across angle `phi` repeating `count` times round the disc: a
 * narrow crest with a rounded top and a broad trough between crests.
 */
function ridge(phi: number, count: number, offset: number) {
  return (0.5 + 0.5 * Math.cos(phi * count + offset)) ** 6;
}

/**
 * The profile of the disc from the middle of its underside out to the rim
 * and back over the top to the mouth, with each point's place: under, rim,
 * or top with how far it lies from the middle, 0 to 1.
 */
function profileOf(radius: number) {
  const under = Arr.map(Arr.range(0, UNDER - 1), (index) => {
    const reach = index / UNDER;
    return [radius * reach, DISC.arch * (1 - reach * reach), -1] as const;
  });
  const rim = [
    [radius * 1.004, 0.0009, -1],
    [radius * 1.008, DISC.rim * 0.6, 1],
  ] as const;
  const top = Arr.map(Arr.range(0, TOP - 1), (index) => {
    const reach = 1 - index / (TOP - 1);
    return [
      radius * reach,
      DISC.rim + DISC.dome * (1 - reach * reach) ** 0.6,
      reach,
    ] as const;
  });
  return Arr.appendAll(Arr.appendAll(under, rim), top);
}

/**
 * A plate coral, a mushroom coral such as Fungia, `radius` across: one large
 * free polyp whose oval disc domes up to a slit mouth, ribbed by septa that
 * radiate from it, 48 primaries and a lower secondary between each pair,
 * their edges toothed. Each primary juts at the margin, which scallops the
 * rim, and the disc undulates gently. Its septa margins are paler and the
 * troughs between them darker, and the underside arches so only its rim
 * rests on the sand.
 */
function plateOf(radius: number, seed: number) {
  const profile = profileOf(radius);
  const lathe = new LatheGeometry(
    Arr.map(profile, ([across, height]) => new Vector2(across, height)),
    AROUND
  );
  const position = lathe.getAttribute("position");
  const tipness = new Float32Array(position.count);
  const shade = new Float32Array(position.count);
  for (const index of Arr.range(0, position.count - 1)) {
    const [, , reach] = profile[index % profile.length] ?? [0, 0, -1];
    const phi = (Math.floor(index / profile.length) / AROUND) * Math.PI * 2;
    const primary = ridge(phi, SEPTA, 0);
    const secondary =
      ridge(phi, SEPTA, Math.PI) * 0.55 * MathUtils.smoothstep(reach, 0.3, 0.5);
    const septum =
      Math.max(primary, secondary) * MathUtils.smoothstep(reach, 0.06, 0.24);
    const teeth = 0.72 + 0.28 * Math.sin(reach * radius * 1100 + phi * 2);
    const rise = reach < 0 ? 0 : DISC.septum * septum * teeth;
    const x = position.getX(index);
    const z = position.getZ(index);
    const mouth =
      reach < 0
        ? 0
        : 0.005 *
          Math.exp(-((x / (radius * 0.24)) ** 2) - (z / (radius * 0.05)) ** 2);
    const scallop =
      1 +
      0.016 * ridge(phi, SEPTA, 0) ** 0.3 +
      0.022 * Math.sin(phi * 5 + seed);
    const wave =
      0.0022 * Math.sin(phi * 3 + seed * 2) * Math.max(0, Math.abs(reach)) ** 2;
    position.setXYZ(
      index,
      x * scallop * 1.1,
      position.getY(index) + rise - mouth + wave,
      z * scallop * 0.9
    );
    tipness[index] =
      reach < 0 ? 0 : septum * 0.3 + 0.3 * MathUtils.smoothstep(reach, 0.85, 1);
    shade[index] = reach < 0 ? 0.5 : 0.66 + 0.34 * septum;
  }
  lathe.deleteAttribute("normal");
  lathe.deleteAttribute("uv");
  lathe.setAttribute("tipness", new BufferAttribute(tipness, 1));
  lathe.setAttribute("shade", new BufferAttribute(shade, 1));
  const disc = mergeVertices(lathe);
  lathe.dispose();
  disc.computeVertexNormals();
  return disc;
}

/**
 * A plate coral lying free on the sand at `position`, turned `turn` radians
 * about the vertical.
 */
export function PlateCoral({
  colony,
  position,
  radius,
  seed,
  turn,
}: {
  readonly colony: Colony;
  readonly position: readonly [number, number, number];
  readonly radius: number;
  readonly seed: number;
  readonly turn: number;
}) {
  const geometry = useMemo(() => plateOf(radius, seed), [radius, seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useTissuePaint(geometry, colony);
  return (
    <mesh
      castShadow
      geometry={geometry}
      position={position}
      receiveShadow
      rotation={[0, turn, 0]}
    >
      <TissueMaterial />
    </mesh>
  );
}
