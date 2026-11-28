import type { Path } from "@repo/design-system/components/three/form/path";

/**
 * A rubber bung in the neck of a flask and the glass delivery tube through
 * it, in metres from the middle of the neck's rim. A bung is tapered: it is
 * a little narrower than the neck at its foot, as wide as the neck at the
 * rim, where it seals, and wider above it, so it always seats in the glass
 * and never through it.
 */

/** A bung: how deep it seats in the neck, how far it stands out of it, and how much it widens above the rim. */
const BUNG = {
  above: 0.008,
  flare: 0.0022,
  round: 0.0014,
  seat: 0.014,
} as const;

/** The outer radius of a delivery tube, and of the rubber sleeve that joins it to what it feeds. */
export const DELIVERY = { sleeve: 0.0052, tube: 0.0032 } as const;

/** How far a delivery tube reaches below its bung, how tightly it bends, and how long its sleeve is. */
const TUBE = { bend: 0.018, below: 0.012, sleeve: 0.024 } as const;

/**
 * The outline of a bung for a neck, as a turned part: bored for the
 * delivery tube, with its rim at y = 0.
 *
 * @param bore - The inner radius of the neck at its rim, in metres
 */
export function bungOf(bore: number) {
  return [
    [DELIVERY.tube, -BUNG.seat],
    [bore - 0.0012, -BUNG.seat],
    [bore - 0.0004, -BUNG.seat + BUNG.round],
    [bore + BUNG.flare, BUNG.above - BUNG.round],
    [bore + BUNG.flare - 0.001, BUNG.above],
    [DELIVERY.tube, BUNG.above],
  ] as const;
}

/**
 * The line of a delivery tube from under its bung up and over to what it
 * feeds, bent in one smooth elbow as a glassblower bends it, and the two
 * ends of the short rubber sleeve that joins the two.
 *
 * @param reach - How far to the side the tube ends, in metres; negative to the left
 * @param rise - How far above the rim the tube ends, in metres
 */
export function deliveryOf(reach: number, rise: number) {
  const toward = Math.sign(reach);
  const route: Path = {
    bend: TUBE.bend,
    kind: "route",
    points: [
      [0, -BUNG.seat - TUBE.below, 0],
      [0, rise, 0],
      [reach, rise, 0],
    ],
  };
  const sleeve: Path = [
    [reach - (toward * TUBE.sleeve) / 2, rise, 0],
    [reach + (toward * TUBE.sleeve) / 2, rise, 0],
  ];
  return { route, sleeve };
}
