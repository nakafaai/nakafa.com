import {
  BRANCHING,
  CUTS,
  FAR,
  FAR_CUT,
  INITIAL,
  NEAR,
  NEAR_CUT,
  SPACING,
  shareOf,
} from "@repo/design-system/components/contents/biology/neuron/course";
import {
  sweep,
  TissueMaterial,
  useOwned,
} from "@repo/design-system/components/contents/biology/neuron/tissue";
import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import { NEURON_COLORS } from "@repo/design-system/lib/material/neuron";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { CatmullRomCurve3, DoubleSide, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * The other bare axons that share each Schwann cell of the bundle, as
 * angles round the neuron's own axon, their distance from it and their
 * radii: a non-myelinating Schwann cell holds several small axons, each in
 * its own fold of its cytoplasm, as a Remak bundle (Griffin and Thompson,
 * "Biology and pathology of nonmyelinating Schwann cells", Glia 56:
 * 1518-1531, 2008).
 */
const NEIGHBOURS = [
  { angle: 0.9, radius: 0.09, reach: 0.29 },
  { angle: 2.6, radius: 0.07, reach: 0.27 },
  { angle: 4.2, radius: 0.1, reach: 0.3 },
] as const;

/** The radius of the bundle's Schwann cells: a bundle about 9 µm across round its few small axons. */
const SLEEVE = 0.46;

/** Where each stretch's bundle starts and ends, as arc lengths along it. */
const SPANS = {
  far: {
    curve: FAR,
    from: FAR_CUT - 0.9,
    stretch: "far" as const,
    to: BRANCHING.share * FAR.getLength() - 0.6,
  },
  near: {
    curve: NEAR,
    from: INITIAL + 0.4,
    stretch: "near" as const,
    to: NEAR_CUT + 0.9,
  },
} as const;

/** The frame round a stretch at `length` along it: its point, an up across it and a side across it. */
function frame(curve: CatmullRomCurve3, length: number) {
  const share = Math.min(1, Math.max(0, length / curve.getLength()));
  const point = curve.getPointAt(share);
  const tangent = curve.getTangentAt(share);
  const up = new Vector3(0, 1, 0)
    .addScaledVector(tangent, -tangent.y)
    .normalize();
  return { point, side: new Vector3().crossVectors(tangent, up), up };
}

/**
 * A neighbour's course: alongside the neuron's axon through the bundle and
 * on into the cut, and in from far behind near the hillock or away far
 * behind near the terminals, as the other axons of a nerve come and go.
 */
function neighbour(
  span: (typeof SPANS)["near"] | (typeof SPANS)["far"],
  index: number
) {
  const { angle, reach } = NEIGHBOURS[index] ?? NEIGHBOURS[0];
  const along = Arr.map(Arr.range(0, 24), (step) => {
    const { point, side, up } = frame(
      span.curve,
      span.from + ((span.to - span.from) * step) / 24
    );
    return point
      .addScaledVector(up, Math.cos(angle) * reach)
      .addScaledVector(side, Math.sin(angle) * reach);
  });
  // Far enough behind to leave the scene, so no axon ends in mid-air.
  const behind = new Vector3(0, -2 - index, -40 - index * 4);
  const away = (from: Vector3) => [
    from.clone().addScaledVector(behind, 0.12),
    from.clone().add(behind),
  ];
  const points =
    span.stretch === "near"
      ? [...Arr.reverse(away(Arr.headNonEmpty(along))), ...along]
      : [...along, ...away(Arr.lastNonEmpty(along))];
  return new CatmullRomCurve3(points, false, "centripetal");
}

/**
 * The sleeve of non-myelinating Schwann cells that wraps a bare fibre: soft,
 * translucent cytoplasm, pinched where one Schwann cell meets the next and
 * swollen round each one's nucleus, so the axons inside show through.
 */
function useSleeve(span: (typeof SPANS)["near"] | (typeof SPANS)["far"]) {
  return useOwned(
    useMemo(() => {
      const total = span.to - span.from;
      return sweep({
        curve: span.curve,
        from: shareOf(span.stretch, span.from),
        radius: (along, angle) => {
          const length = span.from + along * total;
          const cell = ((((length - INITIAL) / SPACING) % 1) + 1) % 1;
          const joint = Math.exp(-((Math.min(cell, 1 - cell) / 0.05) ** 2));
          const nucleus =
            Math.exp(-(((cell - 0.5) / 0.09) ** 2)) *
            Math.max(0, Math.cos(angle - 2)) ** 4;
          const ends = Math.min(1, Math.min(along, 1 - along) * total * 1.5);
          const grain =
            0.04 * (valueNoise(length * 1.4, angle * 1.5, 64) - 0.5);
          return (
            (SLEEVE - 0.07 * joint + 0.1 * nucleus + grain) *
            (0.45 + 0.55 * Math.sqrt(ends))
          );
        },
        rings: Math.round(total * 16),
        sides: 32,
        to: shareOf(span.stretch, span.to),
      });
    }, [span])
  );
}

/**
 * A bare fibre's Remak bundle: the other small axons running beside the
 * neuron's own and the translucent Schwann cells round them all, cut where
 * the drawing leaves out the length of the nerve.
 */
export function Remak() {
  return (
    <group>
      <Bundle span={SPANS.near} />
      <Bundle span={SPANS.far} />
    </group>
  );
}

/** The bundle on one stretch: its Schwann cells and the neighbouring axons, cut by that stretch's cut. */
function Bundle({
  span,
}: {
  readonly span: (typeof SPANS)["near"] | (typeof SPANS)["far"];
}) {
  const sleeve = useSleeve(span);
  const axons = useOwned(
    useMemo(() => {
      const parts = Arr.map(NEIGHBOURS, (axon, index) =>
        sweep({
          curve: neighbour(span, index),
          radius: () => axon.radius,
          rings: 320,
          sides: 10,
        })
      );
      const merged = mergeGeometries(parts);
      Arr.forEach(parts, (part) => part.dispose());
      return merged;
    }, [span])
  );
  const clip = useMemo(() => [CUTS[span.stretch].plane], [span]);
  return (
    <group>
      <mesh castShadow geometry={axons} receiveShadow>
        <TissueMaterial clip={clip} color={NEURON_COLORS.neurite} />
      </mesh>
      <mesh geometry={sleeve}>
        <TissueMaterial
          clip={clip}
          color={NEURON_COLORS.remak}
          opacity={0.38}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}
