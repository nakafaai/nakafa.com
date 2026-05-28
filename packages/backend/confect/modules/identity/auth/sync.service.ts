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
import { Clock, Duration, Effect, Option } from "effect";

const syncCustomerRef =
  refs.internal.customers.actions.internalFunctions.syncCustomer;
const cleanupCustomerRef =
  refs.internal.customers.actions.internalFunctions.cleanupUserData;
const cleanupUserRef = refs.internal.auth.cleanup.cleanupDeletedUser;
const sendWelcomeEmailRef = refs.internal.emails.mutations.sendWelcomeEmail;

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
