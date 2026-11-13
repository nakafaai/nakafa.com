/**
 * A micrometer screw gauge: one turn of the thimble moves the spindle by the
 * screw's pitch of half a millimetre, and the thimble carries 50 divisions
 * around its rim, so one division is a hundredth of a millimetre. The sleeve
 * shows whole millimetres above its datum line and half millimetres below it;
 * the thimble division on the datum line adds the hundredths.
 */

/** How far one turn of the thimble moves the spindle, in millimetres. */
export const SCREW_PITCH = 0.5;

/** How many divisions the thimble carries around its rim. */
export const THIMBLE_DIVISIONS = 50;

/** The smallest change the gauge resolves, in millimetres. */
export const SCREW_RESOLUTION = SCREW_PITCH / THIMBLE_DIVISIONS;

/** The thinnest and thickest objects the lab measures, in millimetres. */
export const SCREW_RANGE = { max: 12.5, min: 0.5 } as const;

/**
 * The reading of the gauge closed on an object `thickness` millimetres
 * thick: the last sleeve line the thimble has uncovered, in millimetres, the
 * thimble division on the datum line, and the reading they make together.
 */
export function micrometerReading(thickness: number) {
  const hundredths = Math.round(thickness / SCREW_RESOLUTION);
  const turns = Math.floor(hundredths / THIMBLE_DIVISIONS);
  const division = hundredths - turns * THIMBLE_DIVISIONS;
  return {
    division,
    reading: hundredths / (THIMBLE_DIVISIONS / SCREW_PITCH),
    sleeve: turns * SCREW_PITCH,
  };
}

/**
 * How far the thimble has turned past its zero, in divisions, when the
 * spindle has moved `travel` millimetres: the turns the screw made, as the
 * fraction of a rim that faces the datum line.
 */
export function thimbleTurn(travel: number) {
  const divisions = travel / SCREW_RESOLUTION;
  return divisions - Math.floor(divisions / THIMBLE_DIVISIONS) * THIMBLE_DIVISIONS;
}
