import { Array as Arr } from "effect";

/**
 * The tube of a Thomson experiment at real size, in centimetres: the beam
 * leaves the anode at x = 0 into plates 5 cm long and 1 cm apart, and lands on
 * a screen 7 cm past their end.
 */
export const TUBE = { gap: 1, plates: 5, screen: 7 } as const;

/** The voltage that speeds the electrons up between cathode and anode, in volts. */
export const ANODE_VOLTAGE = 2000;

/**
 * How far an electron has dropped toward the positive plate after `x` cm along
 * the beam, for plate voltage `plate` volts. Inside the plates the force is
 * steady, so the path is a parabola, y = V_p x^2 / (4 d V_a), in which the
 * electron's charge and mass cancel; past the plates it runs straight on along
 * its exit slope. A positive voltage makes the top plate positive and pulls the
 * negative beam up.
 */
export function beamHeight(x: number, plate: number) {
  const curve = plate / (4 * TUBE.gap * ANODE_VOLTAGE);
  if (x <= TUBE.plates) {
    return curve * Math.max(0, x) ** 2;
  }
  const exit = curve * TUBE.plates ** 2;
  const slope = 2 * curve * TUBE.plates;
  return exit + slope * (x - TUBE.plates);
}

/** Where the beam lands on the screen, its height in centimetres. */
export function spotHeight(plate: number) {
  return beamHeight(TUBE.plates + TUBE.screen, plate);
}

/**
 * The largest plate voltage the beam clears the plates at: above it the beam
 * strikes a plate before it leaves them, where y = d / 2 at x = L.
 */
export const PLATE_LIMIT = (2 * TUBE.gap ** 2 * ANODE_VOLTAGE) / TUBE.plates ** 2;

/** The beam's path as points (x, y) in centimetres, from the anode to the screen. */
export function beamPath(plate: number, samples: number) {
  const end = TUBE.plates + TUBE.screen;
  return Arr.map(Arr.range(0, samples), (step) => {
    const x = (end * step) / samples;
    return [x, beamHeight(x, plate)] as const;
  });
}
