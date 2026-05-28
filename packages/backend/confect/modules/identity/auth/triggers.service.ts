import type { Doc } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import { DEFAULT_USER_PLAN } from "@repo/backend/confect/modules/commerce/credits.policy";
import type { betterAuthUserSchema } from "@repo/backend/confect/modules/identity/auth/auth.schemas";
import { captureProductEvent } from "@repo/backend/confect/modules/integrations/analytics";
import { posthog } from "@repo/backend/confect/modules/integrations/posthog";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { toConvexReference } from "@repo/backend/confect/modules/shared/convexReferences";
import { Clock, Effect } from "effect";

type AuthUser = typeof betterAuthUserSchema.Type;
type LinkAuthUser = (
  authId: AuthUser["_id"],
  userId: Doc<"users">["_id"]
) => Promise<void>;

const createSyncedUserRef = toConvexReference(
  refs.internal.auth.sync.createSyncedUser
);
const updateSyncedUserRef = toConvexReference(
  refs.internal.auth.sync.updateSyncedUser
);
const cleanupSyncedUserRef = toConvexReference(
  refs.internal.auth.sync.cleanupSyncedUser
);

/** Creates the app-side user graph after Better Auth creates a user. */
export const createSyncedAuthUser = Effect.fn("identity.createSyncedAuthUser")(
  function* (
    ctx: ConvexMutationCtx,
    authUser: AuthUser,
    linkAuthUser: LinkAuthUser
  ) {
    const now = yield* Clock.currentTimeMillis;
    const signedUpAt = new Date(now).toISOString();
    const userId = yield* Effect.promise(() =>
      ctx.runMutation(createSyncedUserRef, {
        authId: authUser._id,
        email: authUser.email,
        image: authUser.image ?? null,
        name: authUser.name,
      })
    );
    yield* Effect.promise(() =>
      posthog.identify(ctx, {
        distinctId: userId,
        disableGeoip: true,
        properties: {
          $set: {
            email: authUser.email,
            name: authUser.name,
            plan: DEFAULT_USER_PLAN,
          },
          $set_once: {
            signed_up_at: signedUpAt,
          },
        },
      })
    );
    yield* Effect.promise(() =>
      captureProductEvent(ctx, {
        distinctId: userId,
        event: {
          name: "user signed up",
          properties: {
            plan: DEFAULT_USER_PLAN,
          },
        },
        timestamp: new Date(now),
      })
    );
    yield* Effect.promise(() => linkAuthUser(authUser._id, userId));

    return null;
  }
);

/** Mirrors Better Auth user profile updates into the app user table. */
export const syncUpdatedAuthUser = Effect.fn("identity.syncUpdatedAuthUser")(
  function* (
    ctx: ConvexMutationCtx,
    newAuthUser: AuthUser,
    oldAuthUser: AuthUser
  ) {
    const hasProfileChanges =
      newAuthUser.name !== oldAuthUser.name ||
      newAuthUser.image !== oldAuthUser.image ||
      newAuthUser.email !== oldAuthUser.email;
    if (!hasProfileChanges) {
      return null;
    }

    yield* Effect.promise(() =>
      ctx.runMutation(updateSyncedUserRef, {
        authId: newAuthUser._id,
        email: newAuthUser.email,
        image: newAuthUser.image ?? undefined,
        name: newAuthUser.name,
      })
    );

    return null;
  }
);

/** Schedules app-side cleanup after Better Auth deletes a user. */
export const cleanupDeletedAuthUser = Effect.fn(
  "identity.cleanupDeletedAuthUser"
)(function* (ctx: ConvexMutationCtx, authUser: AuthUser) {
  yield* Effect.promise(() =>
    ctx.runMutation(cleanupSyncedUserRef, { authId: authUser._id })
  );

  return null;
});
