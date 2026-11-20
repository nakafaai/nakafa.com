import { Array as Arr, Schema } from "effect";

/**
 * One nerve fibre the lab sends an impulse along: its diameter in
 * micrometres (the outer diameter, myelin included, for a myelinated fibre)
 * and whether a myelin sheath wraps it.
 */
const FibreSchema = Schema.Struct({
  diameter: Schema.Finite,
  myelinated: Schema.Boolean,
  name: Schema.String,
});
export type Fibre = typeof FibreSchema.Type;

/**
 * Metres a second gained for each micrometre of a myelinated fibre's outer
 * diameter. Hursh measured the fastest fibres of cat and kitten nerves, from
 * 8 to 117 m/s, and their points lay on a straight line of slope 6
 * (J. B. Hursh, "Conduction velocity and diameter of nerve fibers", Am. J.
 * Physiol. 127: 131-139, 1939; the slope as H. S. Gasser gives it in his
 * Nobel lecture, 1945, p. 38).
 */
export const HURSH = 6;

/**
 * The squid giant axon whose impulse Hodgkin and Huxley timed: radius
 * 238 micrometres and a measured speed of 21.2 m/s at 18.5 °C (A. L. Hodgkin
 * and A. F. Huxley, J. Physiol. 117: 500-544, 1952, Part III). An
 * unmyelinated fibre's speed grows with the square root of its diameter
 * (A. L. Hodgkin, "A note on conduction velocity", J. Physiol. 125: 221-224,
 * 1954), so this one axon scales the speed of every other: about 1 m/s for a
 * fibre 1 micrometre wide, the speed of the mammalian C fibres Gasser
 * timed at 0.7 to 2.3 m/s (J. Gen. Physiol. 33: 651-690, 1950).
 */
const SQUID = { diameter: 476, speed: 21.2 } as const;

/**
 * An internode, the length of axon one Schwann cell wraps, is about 100
 * times the fibre's diameter (W. A. H. Rushton, J. Physiol. 115: 101-122,
 * 1951; OpenStax Anatomy and Physiology 2e, section 12.2, gives sheaths 100
 * to 1000 times the axon's diameter).
 */
export const INTERNODE = 100;

/** A node of Ranvier is about one micrometre long (OpenStax Biology 2e, section 35.2). */
export const NODE = 1;

/**
 * The axon's share of a myelinated fibre's diameter, its g-ratio, which
 * Rushton (1951) found best at 0.6: the rest is the myelin sheath.
 */
export const G_RATIO = 0.6;

/**
 * The resting potential and the threshold of a neuron, in millivolts
 * (OpenStax Anatomy and Physiology 2e, section 12.4).
 */
export const REST = -70;
export const THRESHOLD = -55;

/**
 * The Hodgkin-Huxley membrane, in the modern sign convention: conductances
 * in mS cm⁻², reversal potentials in mV, capacitance in µF cm⁻², resting at
 * -65 mV (Hodgkin and Huxley 1952; values as tabulated in Sterratt et al.,
 * Principles of Computational Modelling in Neuroscience, 2011, box 3.5).
 */
const MEMBRANE = {
  capacitance: 1,
  leak: { conductance: 0.3, reversal: -54.4 },
  potassium: { conductance: 36, reversal: -77 },
  rest: -65,
  sodium: { conductance: 120, reversal: 50 },
} as const;

/**
 * The temperature the impulse is computed at, the 18.5 °C of Hodgkin and
 * Huxley's propagated action potential, and the factor of 3 for every 10 °C
 * by which their gates speed up from the 6.3 °C they were measured at.
 */
const TEMPERATURE = 18.5;
const Q10 = 3;

/**
 * The local current that reaches a patch of membrane from the active
 * membrane behind it, in µA cm⁻² over milliseconds: the lab's choice of a
 * brief pulse that carries the patch past threshold in about 0.15 ms.
 */
const STIMULUS = { current: 100, duration: 0.2 } as const;

/** The integration step and the step between stored samples, in ms, and how long the impulse is followed. */
const STEP = 0.0025;
const SAMPLE = 0.01;
const SPAN = 16;

/** x / (eˣ − 1), which tends to 1 as x tends to 0. */
function relative(x: number) {
  return Math.abs(x) < 1e-9 ? 1 - x / 2 : x / Math.expm1(x);
}

/**
 * The Hodgkin-Huxley opening (α) and closing (β) rates of the n, m and h
 * gates at membrane potential `v` (mV, resting at -65), per millisecond at
 * 6.3 °C. The two rates that divide by zero at -55 and -40 mV take their
 * limit there.
 */
export function gates(v: number) {
  return {
    h: {
      closing: 1 / (Math.exp(-(v + 35) / 10) + 1),
      opening: 0.07 * Math.exp(-(v + 65) / 20),
    },
    m: {
      closing: 4 * Math.exp(-(v + 65) / 18),
      opening: relative(-(v + 40) / 10),
    },
    n: {
      closing: 0.125 * Math.exp(-(v + 65) / 80),
      opening: 0.1 * relative(-(v + 55) / 10),
    },
  };
}

/** The state of a patch of membrane: its potential and its three gates. */
type Patch = readonly [number, number, number, number];

/** The sodium and potassium currents through a patch, µA cm⁻², positive outward. */
function currents([v, n, m, h]: Patch) {
  return {
    potassium:
      MEMBRANE.potassium.conductance *
      n ** 4 *
      (v - MEMBRANE.potassium.reversal),
    sodium:
      MEMBRANE.sodium.conductance * m ** 3 * h * (v - MEMBRANE.sodium.reversal),
  };
}

/** How fast a patch changes at time `t` after the local current reaches it. */
function slope(patch: Patch, t: number, speedUp: number): Patch {
  const [v, n, m, h] = patch;
  const rate = gates(v);
  const { potassium, sodium } = currents(patch);
  const leak = MEMBRANE.leak.conductance * (v - MEMBRANE.leak.reversal);
  const local = t < STIMULUS.duration ? STIMULUS.current : 0;
  return [
    (local - sodium - potassium - leak) / MEMBRANE.capacitance,
    speedUp * (rate.n.opening * (1 - n) - rate.n.closing * n),
    speedUp * (rate.m.opening * (1 - m) - rate.m.closing * m),
    speedUp * (rate.h.opening * (1 - h) - rate.h.closing * h),
  ];
}

/** One gate at rest: open for the share α / (α + β). */
function resting(gate: { readonly closing: number; readonly opening: number }) {
  return gate.opening / (gate.opening + gate.closing);
}

/** `patch` moved along `rate` for `step` ms. */
function advance(patch: Patch, rate: Patch, step: number): Patch {
  return [
    patch[0] + rate[0] * step,
    patch[1] + rate[1] * step,
    patch[2] + rate[2] * step,
    patch[3] + rate[3] * step,
  ];
}

/**
 * The action potential of one patch of membrane after the local current
 * reaches it, solved from the Hodgkin-Huxley equations at 18.5 °C by the
 * fourth-order Runge-Kutta method. The squid membrane rests at -65 mV; every
 * potential is moved by the 5 mV to the -70 mV of a typical neuron, so the
 * curve rises past the -55 mV threshold to about +30 mV, falls below rest to
 * about -80 mV, and recovers, as OpenStax describes it. Each sample is
 * `SAMPLE` ms apart; currents are in µA cm⁻², positive outward.
 */
function solve() {
  const speedUp = Q10 ** ((TEMPERATURE - 6.3) / 10);
  const rest = gates(MEMBRANE.rest);
  const count = Math.round(SPAN / SAMPLE) + 1;
  const every = Math.round(SAMPLE / STEP);
  const potential = new Float64Array(count);
  const sodium = new Float64Array(count);
  const potassium = new Float64Array(count);
  let patch: Patch = [
    MEMBRANE.rest,
    resting(rest.n),
    resting(rest.m),
    resting(rest.h),
  ];
  for (let sample = 0; sample < count; sample += 1) {
    const flow = currents(patch);
    potential[sample] = patch[0] + REST - MEMBRANE.rest;
    sodium[sample] = flow.sodium;
    potassium[sample] = flow.potassium;
    for (let substep = 0; substep < every; substep += 1) {
      const t = (sample * every + substep) * STEP;
      const k1 = slope(patch, t, speedUp);
      const k2 = slope(advance(patch, k1, STEP / 2), t + STEP / 2, speedUp);
      const k3 = slope(advance(patch, k2, STEP / 2), t + STEP / 2, speedUp);
      const k4 = slope(advance(patch, k3, STEP), t + STEP, speedUp);
      patch = [
        patch[0] + (STEP / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
        patch[1] + (STEP / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
        patch[2] + (STEP / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
        patch[3] + (STEP / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]),
      ];
    }
  }
  return {
    potassium: Arr.fromIterable(potassium),
    potential: Arr.fromIterable(potential),
    sodium: Arr.fromIterable(sodium),
  };
}

/** The action potential every patch of axon fires, solved once. */
export const SPIKE = solve();

/** The sample of `series` at `t` ms after the local current arrives, read between samples; `outside` before and after. */
function sampleAt(series: readonly number[], t: number, outside: number) {
  const place = t / SAMPLE;
  const below = Math.floor(place);
  if (below < 0 || below >= series.length - 1) {
    return outside;
  }
  const low = Arr.getUnsafe(series, below);
  const high = Arr.getUnsafe(series, below + 1);
  return low + (high - low) * (place - below);
}

/** The potential the patch has settled back to by the end of the solved span, mV. */
const SETTLED = Arr.getUnsafe(SPIKE.potential, SPIKE.potential.length - 1);

/** When the spike peaks, in ms after the local current reaches the patch. */
export const RISE =
  Arr.reduce(SPIKE.potential, 0, (best, sample, index) =>
    sample > Arr.getUnsafe(SPIKE.potential, best) ? index : best
  ) * SAMPLE;

/** The membrane potential, mV, `t` ms after the local current reaches the patch. */
export function potentialAt(t: number) {
  return sampleAt(SPIKE.potential, t, t < 0 ? REST : SETTLED);
}

/** The largest inward sodium and outward potassium currents of the spike, µA cm⁻². */
const PEAK = {
  potassium: Math.max(...SPIKE.potassium),
  sodium: -Math.min(...SPIKE.sodium),
};

/**
 * How strongly ions cross the patch `t` ms after the local current reaches
 * it, each as a share of its own peak: sodium flowing in, potassium flowing
 * out, and the local current itself, which is on only while it charges the
 * patch.
 */
export function flowAt(t: number) {
  return {
    local: t >= 0 && t < STIMULUS.duration ? 1 : 0,
    potassium: Math.max(0, sampleAt(SPIKE.potassium, t, 0) / PEAK.potassium),
    sodium: Math.max(0, -sampleAt(SPIKE.sodium, t, 0) / PEAK.sodium),
  };
}

/**
 * The impulse's speed along `fibre`, in m/s: in proportion to the diameter
 * for a myelinated fibre (Hursh), with its square root for a bare one
 * (Hodgkin, scaled through the squid giant axon).
 */
export function speed(fibre: Fibre) {
  return fibre.myelinated
    ? HURSH * fibre.diameter
    : SQUID.speed * Math.sqrt(fibre.diameter / SQUID.diameter);
}

/** The bare-fibre speed of a fibre one micrometre across, m/s: the factor before √d. */
export const BARE = SQUID.speed / Math.sqrt(SQUID.diameter);

/** The time the impulse takes over `length` metres of `fibre`, in milliseconds. */
export function travel(length: number, fibre: Fibre) {
  return (length / speed(fibre)) * 1000;
}
