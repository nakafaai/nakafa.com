import { forSeed } from "@repo/mascot/seed";

/**
 * The animal of an account, given by its Better Auth id. The same id always
 * gives the same animal, and the id exists before the app row does, so account
 * creation and the backfill of older accounts share this one rule.
 */
export function accountMascot(authId: string) {
  return forSeed(authId);
}
