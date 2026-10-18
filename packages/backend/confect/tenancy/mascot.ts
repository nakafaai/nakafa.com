import { forSeed } from "@repo/mascot/seed";

/**
 * The animal of a school, given by its tenant ID. The same ID always gives the
 * same animal, so no animal is stored: every read derives it, the way an
 * account's animal is derived from its auth ID (`confect/users/mascot.ts`).
 */
export function schoolMascot(tenantId: string) {
  return forSeed(tenantId);
}
