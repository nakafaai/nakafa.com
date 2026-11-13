import { forSeed } from "@repo/mascot/seed";

/**
 * The animal of a new account, given by a seed that exists before the account
 * row does: the Google account's `sub`, or a school account's own seed. The
 * same seed always gives the same animal, so the account is made with its
 * animal in the same transaction.
 */
export function accountMascot(seed: string) {
  return forSeed(seed);
}
