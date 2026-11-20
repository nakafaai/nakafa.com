import { Array as Arr } from "effect";
import type { Face, Vec } from "@/lib/island/models/parts";
import {
  box,
  loft,
  meters as m,
  mirrored,
  rgb,
  rigged,
} from "@/lib/island/models/parts";
import { slab } from "@/lib/island/models/solids";

const BACK = rgb(0x3b_4a_5c);
const BELLY = rgb(0xdf_e6_ea);
const KNOB = rgb(0x2c_38_47);

/** How long the whale is from its snout to the notch of its flukes, in meters. */
const LENGTH = 13;

/**
 * How the whale swims (ADR 0047, D48): its flukes beat up and down once
 * every four seconds or so, a quarter of a wavelength behind its snout, as a
 * humpback's do at about 1.5 body lengths over its speed (2.2 m/s); its body
 * swells into the beat toward the tail, and its flippers rise and fall a
 * little behind it.
 */
const BEAT = 1.6;

/** A point along the whale, `share` of its length back from the snout, in blocks. */
function along(share: number) {
  return m(LENGTH / 2 - LENGTH * share);
}

/**
 * One flipper on the right side, as a humpback's: long and narrow, about a
 * third of the body, its leading edge in a row of knobs (tubercles), swept
 * back and drooping from its root low on the flank.
 */
function flipperOf(): readonly Face[] {
  const root: Vec = [m(1.05), m(-1.55), along(0.3)];
  const span = m(4.2);
  const sweep = 0.55;
  const droop = 0.42;
  const out: Vec = [
    Math.cos(droop) * Math.cos(sweep),
    -Math.sin(droop),
    -Math.cos(droop) * Math.sin(sweep),
  ];
  const back: Vec = [-Math.sin(sweep) * 0.2, 0, -Math.cos(sweep)];
  const point = (s: number, chord: number): Vec => [
    root[0] + out[0] * span * s + back[0] * chord,
    root[1] + out[1] * span * s + back[1] * chord,
    root[2] + out[2] * span * s + back[2] * chord,
  ];
  const width = (s: number) => m(0.95 * (1 - s) + 0.18 * s);
  const knobs = Arr.makeBy(9, (index) => {
    const s = index / 8;
    return point(s, index % 2 === 0 ? 0 : m(0.12));
  });
  const trailing = Arr.makeBy(6, (index) => {
    const s = 1 - index / 5;
    return point(s, width(s));
  });
  return slab(Arr.appendAll(knobs, trailing), m(0.14), BELLY);
}

/**
 * One fluke wing on the right side: swept back from the narrow tail stock in
 * a curved leading edge to a pointed tip, with a ragged trailing edge that
 * returns to the notch in the middle, as a humpback's.
 */
function flukeOf(): readonly Face[] {
  const y = m(-0.35);
  const at = (x: number, back: number): Vec => [m(x), y, along(0.9 + back)];
  return slab(
    [
      at(0.12, 0),
      at(0.7, 0.012),
      at(1.25, 0.032),
      at(1.75, 0.06),
      at(2.05, 0.085),
      at(1.8, 0.088),
      at(1.45, 0.08),
      at(1.1, 0.085),
      at(0.7, 0.078),
      at(0.3, 0.08),
      at(0.08, 0.062),
    ],
    m(0.12),
    BACK
  );
}

/** The small dorsal fin on its hump two thirds of the way back, a low triangle. */
function dorsalOf(): readonly Face[] {
  return slab(
    [
      [0, m(0.15), along(0.62)],
      [0, m(0.55), along(0.67)],
      [0, m(0.1), along(0.72)],
    ],
    m(0.16),
    BACK
  );
}

/**
 * A young humpback whale at real scale (ADR 0047, D21): 13 m from its blunt
 * head to the notch of its flukes, facing +z with its back at y = 0, so it
 * swims with its back just breaking the sea. A slate back over a pale belly,
 * a row of knobs along its head, long pale flippers with knobbed leading
 * edges, a small dorsal fin on its hump, and wide swept flukes, its whole
 * body heaving into each beat of them (D48).
 */
export function whaleFaces(): readonly Face[] {
  const section = (
    share: number,
    width: number,
    depth: number,
    rise: number,
    part: "back" | "belly"
  ) => {
    const split = rise - depth * 0.45;
    return {
      high: m(part === "back" ? rise : split),
      low: m(part === "back" ? split : rise - depth),
      width: m(part === "back" ? width : width * 0.92),
      z: along(share),
    };
  };
  const shape = [
    [0, 0.35, 0.9, -0.35],
    [0.06, 0.85, 1.9, -0.1],
    [0.16, 1.2, 2.6, 0],
    [0.32, 1.45, 3.0, 0.1],
    [0.5, 1.3, 2.7, 0.05],
    [0.66, 0.95, 2.0, 0],
    [0.8, 0.5, 1.15, -0.15],
    [0.9, 0.2, 0.55, -0.3],
  ] as const;
  const knobs = Arr.flatMap(
    Arr.makeBy(5, (index) => index),
    (index) =>
      box(
        [m(-0.42 + (index % 2) * 0.5), m(-0.12), along(0.03 + index * 0.025)],
        [m(-0.25 + (index % 2) * 0.5), m(0.02), along(0.015 + index * 0.025)],
        KNOB
      )
  );
  const flipper = rigged(flipperOf(), {
    mode: "flap",
    phase: -0.8,
    pivot: m(1.05),
    rate: BEAT,
    reach: 0.12,
    waves: 0,
  });
  const body = [
    ...loft(
      Arr.map(shape, ([s, w, d, r]) => section(s, w, d, r, "back")),
      BACK
    ),
    ...loft(
      Arr.map(shape, ([s, w, d, r]) => section(s, w, d, r, "belly")),
      BELLY
    ),
    ...knobs,
    ...dorsalOf(),
    ...flukeOf(),
    ...mirrored(flukeOf()),
  ];
  return [
    ...rigged(body, {
      mode: "heave",
      phase: 0,
      pivot: 0,
      rate: BEAT,
      reach: 0.05,
      waves: 0.25,
    }),
    ...flipper,
    ...mirrored(flipper),
  ];
}
