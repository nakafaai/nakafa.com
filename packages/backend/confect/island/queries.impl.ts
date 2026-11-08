import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  getOptionalAppUserForRead,
  Session,
} from "@repo/backend/confect/auth/session";
import spec from "@repo/backend/confect/island/queries.spec";
import { findIsland } from "@repo/backend/confect/island/store";
import {
  toOwnIsland,
  toVisitedIsland,
} from "@repo/backend/confect/island/view";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { getAppUserByUsername } from "@repo/backend/confect/users/directory";
import { profileAccess } from "@repo/backend/confect/users/profile";
import { Effect, Layer, Option } from "effect";

const own = FunctionImpl.make(
  databaseSchema,
  spec,
  "own",
  Effect.fn("island.queries.own")(function* () {
    const user = yield* getOptionalAppUserForRead();
    if (!user) {
      return null;
    }
    const island = yield* findIsland(user.appUser._id);
    return Option.match(island, {
      onNone: () => null,
      onSome: toOwnIsland,
    });
  })
);

/**
 * An island opens to a visitor when its owner made it `link` or `public` and
 * the owner's profile opens to that visitor: a school member's island stays
 * with its owner, as their profile does. Any other island answers as one that
 * does not exist.
 */
const visit = FunctionImpl.make(
  databaseSchema,
  spec,
  "visit",
  Effect.fn("island.queries.visit")(function* ({ username }) {
    const { appUser } = yield* Session;
    const owner = yield* getAppUserByUsername(username);
    if (owner === null || owner.deletedAt !== undefined) {
      return null;
    }
    const island = yield* findIsland(owner._id);
    if (Option.isNone(island) || island.value.visibility === "private") {
      return null;
    }
    const access = yield* profileAccess(owner._id, appUser?._id ?? null);
    if (!access.opens) {
      return null;
    }
    return toVisitedIsland(island.value, owner, username);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(own),
  Layer.provide(visit),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
