import { Schema } from "effect";

/**
 * A tug of war on one straight rope. Each puller adds the same pull, so a
 * team of n pulls with n times one pull: a scalar multiple of one vector.
 * Toward the left the pull is negative, the opposite of the same pull to the
 * right. The rope's net force is the sum of the two teams' vectors, and it
 * is the zero vector when the teams match.
 */

/** The teams: one puller's pull in newtons and the size of each team. */
export const TeamsSchema = Schema.Struct({
  left: Schema.Int.pipe(
    Schema.check(Schema.isBetween({ maximum: 8, minimum: 0 }))
  ),
  pull: Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0))),
  right: Schema.Int.pipe(
    Schema.check(Schema.isBetween({ maximum: 8, minimum: 0 }))
  ),
});
type Teams = typeof TeamsSchema.Type;

/** The two teams' forces along the rope, right positive, and their sum, in newtons. */
export function ropeForces(teams: Teams) {
  const left = -teams.left * teams.pull;
  const right = teams.right * teams.pull;
  return { left, net: left + right, right };
}
