import { TUBE } from "@repo/design-system/components/contents/chemistry/cathode/beam";
import { Array as Arr } from "effect";

/**
 * The glass envelope of Thomson's tube along its axis, in the lab's units
 * (one unit is about 2.5 cm, so the tube is about 40 cm long, as the
 * Cavendish original is): a rounded end that holds the cathode's stem, a
 * neck that holds the electrodes and the plates, and a flare out to the
 * wide bulb whose shallow dome carries the screen.
 */
export const ENVELOPE = {
  /** Where the dome of the screen end peaks. */
  apex: TUBE.plates + TUBE.screen + 0.3,
  /** The radius of the wide bulb at the screen. */
  bulb: 2.7,
  /** Where the rounded cathode end closes. */
  end: -5.3,
  /** Where the neck starts to flare. */
  flare: 6,
  /** The radius of the neck. */
  neck: 0.95,
  /** Where the flare reaches the bulb's full radius. */
  shoulder: TUBE.plates + TUBE.screen - 0.7,
} as const;

/**
 * The radius of the envelope at a point `x` along its axis: a quarter circle
 * closing the cathode end, the straight neck, a cosine flare that leaves the
 * neck and meets the bulb without a crease, and a spherical cap over the
 * screen end.
 */
export function envelopeRadius(x: number) {
  const { apex, bulb, end, flare, neck, shoulder } = ENVELOPE;
  if (x <= end || x >= apex) {
    return 0;
  }
  if (x < end + neck) {
    const along = end + neck - x;
    return Math.sqrt(Math.max(0, neck * neck - along * along));
  }
  if (x <= flare) {
    return neck;
  }
  if (x <= shoulder) {
    const share = (x - flare) / (shoulder - flare);
    return neck + ((bulb - neck) * (1 - Math.cos(Math.PI * share))) / 2;
  }
  const depth = apex - shoulder;
  const sphere = (bulb * bulb + depth * depth) / (2 * depth);
  const fromCentre = x - (apex - sphere);
  return Math.sqrt(Math.max(0, sphere * sphere - fromCentre * fromCentre));
}

/**
 * The envelope's outline as the points a lathe turns, radius first and the
 * axial position second, from the cathode end to the dome's apex.
 */
export function envelopeOutline(samples: number) {
  const { apex, end } = ENVELOPE;
  return Arr.map(Arr.range(0, samples), (step) => {
    const x = end + ((apex - end) * step) / samples;
    return [envelopeRadius(x), x] as const;
  });
}
