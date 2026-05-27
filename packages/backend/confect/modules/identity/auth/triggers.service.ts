import { Ref } from "@confect/core";
import type { createClient } from "@convex-dev/better-auth";
import type { Doc } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DEFAULT_USER_CREDITS,
  DEFAULT_USER_PLAN,
  getCurrentCreditResetTimestamp,
} from "@repo/backend/confect/modules/commerce/credits.policy";
import { captureProductEvent } from "@repo/backend/confect/modules/integrations/analytics";
import { posthog } from "@repo/backend/confect/modules/integrations/posthog";
import type { ConvexDataModel } from "@repo/backend/confect/modules/shared/convexContext";
import { Clock, Effect } from "effect";

type AuthClientConfig = Extract<
  NonNullable<Parameters<typeof createClient<ConvexDataModel>>[1]>,
  { triggers: unknown }
>;
type AuthUserTriggers = NonNullable<AuthClientConfig["triggers"]["user"]>;
type AuthCreateArgs = Parameters<NonNullable<AuthUserTriggers["onCreate"]>>;
type AuthUpdateArgs = Parameters<NonNullable<AuthUserTriggers["onUpdate"]>>;
type AuthDeleteArgs = Parameters<NonNullable<AuthUserTriggers["onDelete"]>>;
type LinkAuthUser = (
  authId: AuthCreateArgs[1]["_id"],
  userId: Doc<"users">["_id"]
) => Promise<void>;

const syncCustomerRef = Ref.getFunctionReference(
  refs.internal.customers.actions.internalFunctions.syncCustomer
);
const cleanupCustomerRef = Ref.getFunctionReference(
  refs.internal.customers.actions.internalFunctions.cleanupUserData
);
const cleanupUserRef = Ref.getFunctionReference(
  refs.internal.auth.cleanup.cleanupDeletedUser
);
const sendWelcomeEmailRef = Ref.getFunctionReference(
  refs.internal.emails.mutations.sendWelcomeEmail
);

/** Creates the app-side user graph after Better Auth creates a user. */
export const createSyncedAuthUser = Effect.fn("identity.createSyncedAuthUser")(
  function* (
    ctx: AuthCreateArgs[0],
    authUser: AuthCreateArgs[1],
    linkAuthUser: LinkAuthUser
  ) {
    const now = yield* Clock.currentTimeMillis;
    const signedUpAt = new Date(now).toISOString();
    const userId = yield* Effect.promise(() =>
      ctx.db.insert("users", {
        email: authUser.email,
        authId: authUser._id,
        name: authUser.name,
        image: authUser.image ?? undefined,
        plan: DEFAULT_USER_PLAN,
        credits: DEFAULT_USER_CREDITS,
        creditsResetAt: getCurrentCreditResetTimestamp(DEFAULT_USER_PLAN, now),
      })
    );

    yield* Effect.promise(() =>
      ctx.db.insert("notificationPreferences", {
        disabledTypes: [],
        userId,
        emailEnabled: true,
        emailDigest: "weekly",
        updatedAt: now,
      })
    );
    yield* Effect.promise(() =>
      ctx.db.insert("notificationCounts", {
        userId,
        unreadCount: 0,
        updatedAt: now,
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
    yield* Effect.promise(() =>
      ctx.scheduler.runAfter(0, syncCustomerRef, { userId })
    );
    yield* Effect.promise(() =>
      ctx.scheduler.runAfter(0, sendWelcomeEmailRef, {
        name: authUser.name,
        email: authUser.email,
      })
    );

    return null;
  }
);

/** Mirrors Better Auth user profile updates into the app user table. */
export const syncUpdatedAuthUser = Effect.fn("identity.syncUpdatedAuthUser")(
  function* (
    ctx: AuthUpdateArgs[0],
    newAuthUser: AuthUpdateArgs[1],
    oldAuthUser: AuthUpdateArgs[2]
  ) {
    const hasProfileChanges =
      newAuthUser.name !== oldAuthUser.name ||
      newAuthUser.image !== oldAuthUser.image ||
      newAuthUser.email !== oldAuthUser.email;
    if (!hasProfileChanges) {
      return null;
    }

    const appUser = yield* Effect.promise(() =>
      ctx.db
        .query("users")
        .withIndex("by_authId", (query) => query.eq("authId", newAuthUser._id))
        .unique()
    );
    if (!appUser) {
      return null;
    }

    yield* Effect.promise(() =>
      ctx.db.patch("users", appUser._id, {
        email: newAuthUser.email,
        name: newAuthUser.name,
        image: newAuthUser.image ?? undefined,
      })
    );
    yield* Effect.promise(() =>
      ctx.scheduler.runAfter(0, syncCustomerRef, { userId: appUser._id })
    );

    return null;
  }
);

/** Schedules app-side cleanup after Better Auth deletes a user. */
export const cleanupDeletedAuthUser = Effect.fn(
  "identity.cleanupDeletedAuthUser"
)(function* (ctx: AuthDeleteArgs[0], authUser: AuthDeleteArgs[1]) {
  const appUser = yield* Effect.promise(() =>
    ctx.db
      .query("users")
      .withIndex("by_authId", (query) => query.eq("authId", authUser._id))
      .unique()
  );
  if (!appUser) {
    return null;
  }

  yield* Effect.promise(() =>
    ctx.scheduler.runAfter(0, cleanupUserRef, { userId: appUser._id })
  );
  yield* Effect.promise(() =>
    ctx.scheduler.runAfter(0, cleanupCustomerRef, { userId: appUser._id })
  );

  return null;
});
