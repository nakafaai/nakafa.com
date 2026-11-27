/**
 * How a retort stand reaches what it holds: the arm of a clamp runs level
 * from the stand's rod to the glass it grips, so the stand is turned to
 * face the glass and its arm is as long as the two are apart.
 */

/**
 * The arm from a stand's rod to what it grips: how far the grip is from the
 * rod across the bench, in metres, and the angle about the vertical that
 * turns the stand's own +x axis toward it, in radians.
 *
 * @param rod - Where the rod stands on the bench, as x and z
 * @param grip - The place gripped, as x, y and z
 */
export function armOf(
  rod: readonly [number, number],
  grip: readonly [number, number, number]
) {
  const across = grip[0] - rod[0];
  const toward = grip[2] - rod[1];
  return {
    reach: Math.hypot(across, toward),
    turn: Math.atan2(-toward, across),
  };
}
