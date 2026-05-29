import refs from "@repo/backend/confect/_generated/refs";
import { Auth, QueryRunner } from "@repo/backend/confect/_generated/services";
import { UnauthorizedUser } from "@repo/backend/confect/modules/identity/auth/session.service";
import { Effect, Schema } from "effect";

const authIdentitySchema = Schema.Struct({ subject: Schema.String });

/** Reads the Convex JWT identity inside action runtime boundaries. */
const readActionAuthIdentity = Effect.fnUntraced(function* () {
  const auth = yield* Auth;
  const identity = yield* auth.getUserIdentity.pipe(
    Effect.catchTag("NoUserIdentityFoundError", () => Effect.succeed(null))
  );

  if (!identity) {
    return null;
  }

  return yield* Schema.decodeUnknown(authIdentitySchema)(identity).pipe(
    Effect.orElseSucceed(() => null)
  );
});

/** Requires the current action request to resolve to a mapped app user. */
export const requireAppUserForAction = Effect.fnUntraced(function* () {
  const runQuery = yield* QueryRunner;
  const identity = yield* readActionAuthIdentity();

  if (!identity) {
    return yield* Effect.fail(
      new UnauthorizedUser({ message: "User not found." })
    );
  }

  const appUser = yield* runQuery(refs.internal.users.queries.getUserByAuthId, {
    authId: identity.subject,
  });

  if (!appUser) {
    return yield* Effect.fail(
      new UnauthorizedUser({ message: "User not found." })
    );
  }

  const authUser = {
    _id: appUser.authId,
    email: appUser.email,
    name: appUser.name,
  };

  if (appUser.image === undefined) {
    return { appUser, authUser };
  }

  return { appUser, authUser: { ...authUser, image: appUser.image } };
});
