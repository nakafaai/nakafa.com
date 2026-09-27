import { DatabaseWriter, Scheduler } from "@confect/server";
import {
  type AuthFunctions,
  createClient,
  type Triggers,
} from "@convex-dev/better-auth";
import authSchema from "@repo/backend/components/betterAuth/schema";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { ACCOUNT_DELETION_RECOVERY_DELAY_MS } from "@repo/backend/confect/auth/deletion/constants";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import {
  DEFAULT_USER_CREDITS,
  DEFAULT_USER_PLAN,
} from "@repo/backend/confect/credits/constants";
import { getCurrentCreditResetTimestamp } from "@repo/backend/confect/credits/state";
import { declareWelcomeIntent } from "@repo/backend/confect/emails/welcome/impl";
import { runConvexProgram } from "@repo/backend/confect/runtime";
import { getAppUserByAuthId } from "@repo/backend/confect/users/directory";
import { internal } from "@repo/backend/convex/_generated/api";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Clock, Duration, Effect, Predicate } from "effect";

type UserTriggers = NonNullable<Triggers<DataModel, typeof authSchema>["user"]>;
type AuthUser = Parameters<NonNullable<UserTriggers["onCreate"]>>[1];

/** Create the app identity and durable welcome intent in the auth transaction. */
const createUser = Effect.fn("auth.lifecycle.createUser")(function* (
  ctx: MutationCtx,
  authUser: AuthUser
) {
  const writer = DatabaseWriter.make(databaseSchema, ctx.db);
  const scheduler = yield* Scheduler.Scheduler.pipe(
    Effect.provide(Scheduler.layer(ctx.scheduler))
  );
  const now = yield* Clock.currentTimeMillis;
  const userId = yield* writer
    .table("users")
    .insert({
      email: authUser.email,
      authId: authUser._id,
      name: authUser.name,
      ...(Predicate.isNullish(authUser.image) ? {} : { image: authUser.image }),
      plan: DEFAULT_USER_PLAN,
      credits: DEFAULT_USER_CREDITS,
      creditsResetAt: getCurrentCreditResetTimestamp(DEFAULT_USER_PLAN, now),
    })
    .pipe(Effect.orDie);
  yield* declareWelcomeIntent(ctx, userId);
  // Better Auth owns this component mutation and its plain Convex reference.
  yield* Effect.promise(() =>
    ctx.runMutation(components.betterAuth.mutations.setUserId, {
      authId: authUser._id,
      userId,
    })
  );
  yield* scheduler.runAfter(
    Duration.zero,
    refs.internal.customers.actions.internal.syncCustomer,
    { userId }
  );
});

/** Project changed profile fields while preventing deleted-account resurrection. */
const updateUser = Effect.fn("auth.lifecycle.updateUser")(function* (
  ctx: MutationCtx,
  newDoc: AuthUser,
  oldDoc: AuthUser
) {
  if (
    newDoc.name === oldDoc.name &&
    newDoc.image === oldDoc.image &&
    newDoc.email === oldDoc.email
  ) {
    return;
  }
  const appUser = yield* getAppUserByAuthId(ctx, newDoc._id);
  if (!appUser || isAccountDeletionPending(appUser)) {
    return;
  }
  yield* DatabaseWriter.make(databaseSchema, ctx.db)
    .table("users")
    .patch(appUser._id, {
      email: newDoc.email,
      name: newDoc.name,
      image: newDoc.image ?? undefined,
    })
    .pipe(Effect.orDie);
  const scheduler = yield* Scheduler.Scheduler.pipe(
    Effect.provide(Scheduler.layer(ctx.scheduler))
  );
  yield* scheduler.runAfter(
    Duration.zero,
    refs.internal.customers.actions.internal.syncCustomer,
    { userId: appUser._id }
  );
});

/** Schedule immediate deletion completion and its durable recovery attempt. */
const scheduleDeletion = Effect.fn("auth.lifecycle.scheduleDeletion")(
  function* (ctx: MutationCtx, authUser: AuthUser) {
    const scheduler = yield* Scheduler.Scheduler.pipe(
      Effect.provide(Scheduler.layer(ctx.scheduler))
    );
    yield* scheduler.runAfter(
      Duration.zero,
      refs.internal.customers.deletion.workflow.finalizeDeletedUserCleanup,
      { authId: authUser._id }
    );
    yield* scheduler.runAfter(
      Duration.millis(ACCOUNT_DELETION_RECOVERY_DELAY_MS),
      refs.internal.customers.deletion.workflow.finalizeDeletedUserCleanup,
      { authId: authUser._id }
    );
  }
);

const authFunctions: AuthFunctions = internal.auth.lifecycle;
export const authComponent = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  {
    authFunctions,
    local: { schema: authSchema },
    verbose: false,
    triggers: {
      user: {
        onCreate: (ctx, authUser): Promise<void> =>
          runConvexProgram(createUser(ctx, authUser)),
        onUpdate: (ctx, newDoc, oldDoc): Promise<void> =>
          runConvexProgram(updateUser(ctx, newDoc, oldDoc)),
        onDelete: (ctx, authUser): Promise<void> =>
          runConvexProgram(scheduleDeletion(ctx, authUser)),
      },
    },
  }
);
