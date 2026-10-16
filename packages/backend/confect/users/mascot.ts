import { forSeed } from "@repo/mascot/seed";

/**
 * The animal of an account, given by its Better Auth id. The same id always
 * gives the same animal, and the id exists before the app row does, so the
 * account is made with its animal in the same transaction.
 */
export function accountMascot(authId: string) {
  return forSeed(authId);
}
