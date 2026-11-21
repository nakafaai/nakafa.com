import { NODE } from "@repo/design-system/components/contents/biology/neuron/conduction";
import {
  CUTS,
  FAR,
  FAR_CUT,
  FIBRE,
  INITIAL,
  lengthOf,
  NEAR,
  NEAR_CUT,
  shareOf,
} from "@repo/design-system/components/contents/biology/neuron/course";
import { END } from "@repo/design-system/components/contents/biology/neuron/playback";
import {
  rounded,
  sweep,
  TissueMaterial,
  useOwned,
} from "@repo/design-system/components/contents/biology/neuron/tissue";
import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import { NEURON_COLORS } from "@repo/design-system/lib/material/neuron";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import type { CatmullRomCurve3, Plane } from "three";
import {
  CircleGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  RingGeometry,
  Vector3,
} from "three";

/** Half a node of Ranvier, 0.5 µm, in drawing units of 10 µm. */
const HALF_NODE = NODE / 20;

/** How long the myelin takes to taper into a node: its paranode, in drawing units. */
const PARANODE = 0.45;

/** How far each stretch runs past its cut, so the slanted cut plane trims it. */
const PAST = 0.9;

/** The linear colour of a hex colour, as three numbers. */
function linear(hex: string) {
  const color = new Color(hex);
  return [color.r, color.g, color.b] as const;
}

/** Ken Perlin's smootherstep from 0 to 1. */
function smooth(x: number) {
  const t = Math.min(1, Math.max(0, x));
  return t * t * t * (t * (6 * t - 15) + 10);
}

/**
 * One internode of myelin between `start` and `end` along `curve`: the
 * glossy sheath one Schwann cell wraps, full width along its length and
 * tapering through the ridged paranodal loops into each node, crossed by two
 * faint oblique Schmidt-Lanterman clefts, with the Schwann cell's nucleus
 * and cytoplasm bulging on one side halfway along (OpenStax Anatomy and
 * Physiology 2e, section 12.2). An end that runs into the cut does not taper.
 */
function useInternode(
  curve: CatmullRomCurve3,
  start: number,
  end: number,
  open: "end" | "none" | "start",
  seed: number
) {
  const geometry = useMemo(() => {
    const span = end - start;
    const lamella = linear(NEURON_COLORS.lamella);
    const nucleus = linear(NEURON_COLORS.schwannNucleus);
    const bulge = (along: number, angle: number) =>
      Math.exp(-((((along - 0.5) * span) / 0.55) ** 2)) *
      Math.max(0, Math.cos(angle - 1.1 - seed)) ** 3;
    return sweep({
      curve,
      from: shareOf(curve === NEAR ? "near" : "far", start),
      radius: (along, angle) => {
        const distance = along * span;
        const fromStart = open === "start" ? PARANODE : distance;
        const fromEnd = open === "end" ? PARANODE : span - distance;
        const taper = smooth(Math.min(fromStart, fromEnd) / PARANODE);
        const loops =
          (1 - taper) *
          taper *
          0.05 *
          Math.sin(Math.min(fromStart, fromEnd) * 70);
        const cleft = Arr.reduce([0.3, 0.71] as const, 0, (dip, at) => {
          const offset = distance - at * span - 0.12 * Math.cos(angle);
          return dip + 0.012 * Math.exp(-((offset / 0.05) ** 2));
        });
        const grain =
          0.006 * (valueNoise(distance * 3 + seed * 5, angle * 2, 64) - 0.5);
        return (
          FIBRE.node +
          (FIBRE.outer - FIBRE.node) * taper +
          loops -
          cleft +
          grain +
          0.13 * bulge(along, angle)
        );
      },
      rings: Math.round(span * 34),
      sides: 30,
      tint: (along, angle) => {
        const mix = Math.min(0.5, bulge(along, angle) * 0.6);
        return [
          lamella[0] + (nucleus[0] - lamella[0]) * mix,
          lamella[1] + (nucleus[1] - lamella[1]) * mix,
          lamella[2] + (nucleus[2] - lamella[2]) * mix,
        ];
      },
      to: shareOf(curve === NEAR ? "near" : "far", end),
    });
  }, [curve, end, open, seed, start]);
  return useOwned(geometry);
}

/** One internode's sheath, cut by `clip` where it runs into the cut. */
function Internode({
  clip,
  curve,
  end,
  open,
  seed,
  start,
}: {
  readonly clip: Plane;
  readonly curve: CatmullRomCurve3;
  readonly end: number;
  readonly open: "end" | "none" | "start";
  readonly seed: number;
  readonly start: number;
}) {
  const geometry = useInternode(curve, start, end, open, seed);
  const planes = useMemo(() => [clip], [clip]);
  return (
    <mesh castShadow geometry={geometry} receiveShadow>
      <TissueMaterial
        clip={planes}
        coat={0.6}
        roughness={0.38}
        sheen={NEURON_COLORS.myelinSheen}
        tinted
      />
    </mesh>
  );
}

/**
 * The axon's radius `length` units along the near stretch: wide in the
 * hillock, thin through the initial segment, and pinched at each node when
 * it is myelinated.
 */
function nearAxon(length: number, myelinated: boolean) {
  const hillock =
    FIBRE.initial + (0.62 - FIBRE.initial) * (1 - smooth(length / 1.3));
  const axon = myelinated ? FIBRE.axon : FIBRE.bare;
  const base =
    hillock + (axon - FIBRE.initial) * smooth((length - INITIAL + 0.4) / 0.4);
  return myelinated
    ? base - pinch(length, Arr.map([1, 2, 3] as const, lengthOf))
    : base;
}

/** How much the axon narrows at the nodes standing at `nodes`, `length` units along. */
function pinch(length: number, nodes: readonly number[]) {
  return Arr.reduce(
    nodes,
    0,
    (sum, node) =>
      sum +
      (FIBRE.axon - FIBRE.node) * Math.exp(-(((length - node) / 0.22) ** 2))
  );
}

/** The axon itself, from the hillock to the cut, and from the cut to the terminal branches. */
export function AxonCore({ myelinated }: { readonly myelinated: boolean }) {
  const near = useOwned(
    useMemo(() => {
      const total = NEAR_CUT + PAST;
      return sweep({
        curve: NEAR,
        radius: (along) => nearAxon(along * total, myelinated),
        rings: 520,
        sides: 18,
        to: shareOf("near", total),
      });
    }, [myelinated])
  );
  const far = useOwned(
    useMemo(() => {
      const from = FAR_CUT - PAST;
      const to = lengthOf(END) + 0.5;
      const nodes = myelinated ? Arr.map([4, 5, 6] as const, lengthOf) : [];
      const axon = myelinated ? FIBRE.axon : FIBRE.bare;
      return sweep({
        curve: FAR,
        from: shareOf("far", from),
        radius: (along) =>
          rounded(
            axon - pinch(from + along * (to - from), nodes),
            axon / (to - from),
            along
          ),
        rings: 360,
        sides: 18,
        to: shareOf("far", to),
      });
    }, [myelinated])
  );
  const nearClip = useMemo(() => [CUTS.near.plane], []);
  const farClip = useMemo(() => [CUTS.far.plane], []);
  return (
    <group>
      <mesh castShadow geometry={near} receiveShadow>
        <TissueMaterial clip={nearClip} color={NEURON_COLORS.neurite} />
      </mesh>
      <mesh castShadow geometry={far} receiveShadow>
        <TissueMaterial clip={farClip} color={NEURON_COLORS.neurite} />
      </mesh>
    </group>
  );
}

/**
 * The myelin sheath: on the near stretch, internodes from the end of the
 * initial segment to the cut; on the far stretch, from the cut to the last
 * node before the terminal branches, where the myelin ends.
 */
export function Myelin() {
  const near = Arr.map([1, 2, 3, 4] as const, (node) => ({
    end: node === 4 ? NEAR_CUT + PAST : lengthOf(node) - HALF_NODE,
    key: `near-${node}`,
    open: node === 4 ? ("end" as const) : ("none" as const),
    seed: node,
    start: lengthOf(node - 1) + HALF_NODE,
  }));
  const far = Arr.map([4, 5, 6] as const, (node) => ({
    end: lengthOf(node) - HALF_NODE,
    key: `far-${node}`,
    open: node === 4 ? ("start" as const) : ("none" as const),
    seed: node,
    start: node === 4 ? FAR_CUT - PAST : lengthOf(node - 1) + HALF_NODE,
  }));
  return (
    <group>
      {Arr.map(near, (part) => (
        <Internode
          clip={CUTS.near.plane}
          curve={NEAR}
          end={part.end}
          key={part.key}
          open={part.open}
          seed={part.seed}
          start={part.start}
        />
      ))}
      {Arr.map(far, (part) => (
        <Internode
          clip={CUTS.far.plane}
          curve={FAR}
          end={part.end}
          key={part.key}
          open={part.open}
          seed={part.seed}
          start={part.start}
        />
      ))}
    </group>
  );
}

/** How many compact lamellae the cut face shows between the axon and the Schwann cell's outer collar. */
const LAMELLAE = 14;

/**
 * The face of the cut through a myelinated internode: the axon in the
 * middle, ringed by the compact lamellae of myelin, light and dark in turn
 * as the major dense lines between them are, inside the Schwann cell's thin
 * outer collar. The slanted cut stretches the rings into ellipses.
 */
export function CutFace({ side }: { readonly side: "far" | "near" }) {
  const cut = CUTS[side];
  const { quaternion, stretch } = useMemo(() => {
    const across = new Vector3()
      .crossVectors(cut.normal, cut.tangent)
      .normalize();
    const along = new Vector3().crossVectors(across, cut.normal).normalize();
    return {
      quaternion: new Quaternion().setFromRotationMatrix(
        new Matrix4().makeBasis(along, across, cut.normal)
      ),
      stretch: 1 / Math.abs(cut.normal.dot(cut.tangent)),
    };
  }, [cut]);
  const rings = useOwned(
    useMemo(() => {
      const ring = new RingGeometry(FIBRE.axon, FIBRE.outer, 72, LAMELLAE);
      const position = ring.getAttribute("position");
      const light = linear(NEURON_COLORS.lamella);
      const dark = linear(NEURON_COLORS.denseLine);
      const colors = new Float32Array(position.count * 3);
      for (const index of Arr.range(0, position.count - 1)) {
        const radius = Math.hypot(position.getX(index), position.getY(index));
        const layer = Math.round(
          ((radius - FIBRE.axon) / (FIBRE.outer - FIBRE.axon)) * LAMELLAE
        );
        colors.set(layer % 2 === 0 ? light : dark, index * 3);
      }
      ring.setAttribute("color", new Float32BufferAttribute(colors, 3));
      return ring;
    }, [])
  );
  const core = useOwned(useMemo(() => new CircleGeometry(FIBRE.axon, 48), []));
  const collar = useOwned(
    useMemo(
      () => new RingGeometry(FIBRE.outer - 0.005, FIBRE.outer + 0.03, 72, 1),
      []
    )
  );
  return (
    <group
      position={cut.point.clone().addScaledVector(cut.normal, 0.003)}
      quaternion={quaternion}
      scale={[stretch, 1, 1]}
    >
      <mesh geometry={core}>
        <TissueMaterial
          coat={0.6}
          color={NEURON_COLORS.axoplasm}
          roughness={0.45}
          side={DoubleSide}
        />
      </mesh>
      <mesh geometry={rings}>
        <TissueMaterial coat={0.7} roughness={0.35} side={DoubleSide} tinted />
      </mesh>
      <mesh geometry={collar}>
        <TissueMaterial color={NEURON_COLORS.schwann} side={DoubleSide} />
      </mesh>
    </group>
  );
}
