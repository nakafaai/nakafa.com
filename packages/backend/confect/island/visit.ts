import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import { FIRST_ACCESS } from "@repo/backend/confect/island/schema";
import { findIsland } from "@repo/backend/confect/island/store";
import { getAppUserByUsername } from "@repo/backend/confect/users/directory";
import { profileAccess } from "@repo/backend/confect/users/profile";
import { Effect, Option } from "effect";

/**
 * The world at a learner's address as the caller may open it (ADR 0050, W6):
 * its island, its owner, and whether the caller is that owner. A world opens
 * to its owner always, and to anyone else, signed in or not, unless it is
 * private. It stands under the owner's profile, so a profile that does not
 * open to the caller (`profileAccess`) closes its world to them too, and the
 * address of a school member never tells that the name is held (ADR 0009,
 * K15). No such learner, no island yet and a world that does not open all
 * answer none.
 */
export const worldOf = Effect.fn("island.visit.world")(function* (
  username: string
) {
  const owner = yield* getAppUserByUsername(username);
  if (!owner) {
    return Option.none();
  }
  const found = yield* findIsland(owner._id);
  if (Option.isNone(found)) {
    return Option.none();
  }
  const island = found.value;
  const viewer = yield* getOptionalAppUserForRead();
  const viewerId = viewer?.appUser._id ?? null;
  if (owner._id === viewerId) {
    return Option.some({ island, own: true, owner });
  }
  const profile = yield* profileAccess(owner._id, viewerId);
  return profile.opens && (island.access ?? FIRST_ACCESS) !== "private"
    ? Option.some({ island, own: false, owner })
    : Option.none();
});
