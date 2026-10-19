import { forSeed } from "@repo/mascot/seed";

/**
 * The animal of a school, given by its address. The same address always gives
 * the same animal, so no animal is stored: every read derives it, the way an
 * account's animal is derived from its auth ID (`confect/users/mascot.ts`). The
 * address is known before the school exists, so the questionnaire that opens a
 * school shows the school's animal before the server answers (K44).
 */
export function schoolMascot(slug: string) {
  return forSeed(slug);
}
