import type { createClient } from "@convex-dev/better-auth";
import type { Doc } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  DEFAULT_USER_CREDITS,
  DEFAULT_USER_PLAN,
  getCurrentCreditResetTimestamp,
} from "@repo/backend/confect/modules/commerce/credits.policy";
import type { authTriggerUserSchema } from "@repo/backend/confect/modules/identity/auth/auth.schemas";
import { captureProductEvent } from "@repo/backend/confect/modules/integrations/analytics";
import { posthog } from "@repo/backend/confect/modules/integrations/posthog";
import type { ConvexDataModel } from "@repo/backend/confect/modules/shared/convexContext";
import { toConvexReference } from "@repo/backend/confect/modules/shared/convexReferences";
import { Clock, Duration, Effect, Option } from "effect";

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

const syncCustomerRef =
  refs.internal.customers.actions.internalFunctions.syncCustomer;
const cleanupCustomerRef =
  refs.internal.customers.actions.internalFunctions.cleanupUserData;
const cleanupUserRef = refs.internal.auth.cleanup.cleanupDeletedUser;
const sendWelcomeEmailRef = refs.internal.emails.mutations.sendWelcomeEmail;
const createSyncedUserRef = toConvexReference(
  refs.internal.auth.sync.createSyncedUser
);
const updateSyncedUserRef = toConvexReference(
  refs.internal.auth.sync.updateSyncedUser
);
const cleanupSyncedUserRef = toConvexReference(
  refs.internal.auth.sync.cleanupSyncedUser
);

/** Creates the app-side user rows for one Better Auth user. */
export const createSyncedAuthUserRecord = Effect.fn(
  "identity.createSyncedAuthUserRecord"
)(function* (args: typeof authTriggerUserSchema.Type) {
  const writer = yield* DatabaseWriter;
  const scheduler = yield* Scheduler;
  const now = yield* Clock.currentTimeMillis;
  const userId = yield* writer.table("users").insert({
    email: args.email,
    authId: args.authId,
    name: args.name,
    image: args.image ?? undefined,
    plan: DEFAULT_USER_PLAN,
    credits: DEFAULT_USER_CREDITS,
    creditsResetAt: getCurrentCreditResetTimestamp(DEFAULT_USER_PLAN, now),
  });

  yield* writer.table("notificationPreferences").insert({
    disabledTypes: [],
    userId,
    emailEnabled: true,
    emailDigest: "weekly",
    updatedAt: now,
  });
  yield* writer.table("notificationCounts").insert({
    userId,
    unreadCount: 0,
    updatedAt: now,
  });
  yield* scheduler.runAfter(Duration.millis(0), syncCustomerRef, { userId });
  yield* scheduler.runAfter(Duration.millis(0), sendWelcomeEmailRef, {
    name: args.name,
    email: args.email,
  });

  return userId;
});

/** Mirrors Better Auth profile changes into the app user table. */
export const updateSyncedAuthUserRecord = Effect.fn(
  "identity.updateSyncedAuthUserRecord"
)(function* (args: typeof authTriggerUserSchema.Type) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const scheduler = yield* Scheduler;
  const appUser = yield* reader
    .table("users")
    .index("by_authId", (query) => query.eq("authId", args.authId))
    .first()
    .pipe(Effect.map(Option.getOrNull));

  if (!appUser) {
    return null;
  }

  yield* writer.table("users").patch(appUser._id, {
    email: args.email,
    name: args.name,
    image: args.image ?? undefined,
  });
  yield* scheduler.runAfter(Duration.millis(0), syncCustomerRef, {
    userId: appUser._id,
  });

  return null;
});

/** Schedules app-side cleanup for one deleted Better Auth user. */
export const cleanupSyncedAuthUserRecord = Effect.fn(
  "identity.cleanupSyncedAuthUserRecord"
)(function* (args: { readonly authId: string }) {
  const reader = yield* DatabaseReader;
  const scheduler = yield* Scheduler;
  const appUser = yield* reader
    .table("users")
    .index("by_authId", (query) => query.eq("authId", args.authId))
    .first()
    .pipe(Effect.map(Option.getOrNull));

  if (!appUser) {
    return null;
  }

  yield* scheduler.runAfter(Duration.millis(0), cleanupUserRef, {
    userId: appUser._id,
  });
  yield* scheduler.runAfter(Duration.millis(0), cleanupCustomerRef, {
    userId: appUser._id,
  });

  return null;
});

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
)(function* (ctx: AuthDeleteArgs[0], authUser: AuthDeleteArgs[1]) {
  yield* Effect.promise(() =>
    ctx.runMutation(cleanupSyncedUserRef, { authId: authUser._id })
  );

  return null;
});
