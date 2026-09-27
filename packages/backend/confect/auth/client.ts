import { RegisteredConvexFunction, RegisteredFunction } from "@confect/server";
import type { AuthFunctions } from "@convex-dev/better-auth";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  Clock,
  Duration,
  Effect,
  Scheduler as EffectScheduler,
  Predicate,
} from "effect";

const runHook = RegisteredFunction.runHandlerPromise(undefined, {
  scheduler: new EffectScheduler.MixedScheduler("sync"),
});

import { createClient, type Triggers } from "@convex-dev/better-auth";
import authSchema from "@repo/backend/components/betterAuth/schema";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseWriter,
  MutationCtx as MutationCtxService,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { ACCOUNT_DELETION_RECOVERY_DELAY_MS } from "@repo/backend/confect/auth/deletion/constants";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import {
  DEFAULT_USER_CREDITS,
  DEFAULT_USER_PLAN,
} from "@repo/backend/confect/credits/constants";
import { getCurrentCreditResetTimestamp } from "@repo/backend/confect/credits/state";
import { declareWelcomeIntent } from "@repo/backend/confect/emails/welcome/impl";
import { getAppUserByAuthId } from "@repo/backend/confect/users/directory";
import { internal } from "@repo/backend/convex/_generated/api";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";

type UserTriggers = NonNullable<Triggers<DataModel, typeof authSchema>["user"]>;
type AuthUser = Parameters<NonNullable<UserTriggers["onCreate"]>>[1];

/** Create the app identity and durable welcome intent in the auth transaction. */
const createUser = Effect.fn("auth.lifecycle.createUser")(function* (
  authUser: AuthUser
) {
  const ctx = yield* MutationCtxService;
  const writer = yield* DatabaseWriter;
  const scheduler = yield* Scheduler;
  const now = yield* Clock.currentTimeMillis;
  const userId = yield* writer
    .table("users")
    .insert({
      email: authUser.email,
      authId: authUser._id,
      name: authUser.name,
      ...(Predicate.isNullish(authUser.image)
        ? {}
        : {
            image: authUser.image,
          }),
      plan: DEFAULT_USER_PLAN,
      credits: DEFAULT_USER_CREDITS,
      creditsResetAt: getCurrentCreditResetTimestamp(DEFAULT_USER_PLAN, now),
    })
    .pipe(Effect.orDie);
  yield* declareWelcomeIntent(userId);
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
    {
      userId,
    }
  );
});

/** Project changed profile fields while preventing deleted-account resurrection. */
const updateUser = Effect.fn("auth.lifecycle.updateUser")(function* (
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
  const appUser = yield* getAppUserByAuthId(newDoc._id);
  if (!appUser || isAccountDeletionPending(appUser)) {
    return;
  }
  yield* (yield* DatabaseWriter)
    .table("users")
    .patch(appUser._id, {
      email: newDoc.email,
      name: newDoc.name,
      image: newDoc.image ?? undefined,
    })
    .pipe(Effect.orDie);
  const scheduler = yield* Scheduler;
  yield* scheduler.runAfter(
    Duration.zero,
    refs.internal.customers.actions.internal.syncCustomer,
    {
      userId: appUser._id,
    }
  );
});

/** Schedule immediate deletion completion and its durable recovery attempt. */
const scheduleDeletion = Effect.fn("auth.lifecycle.scheduleDeletion")(
  function* (authUser: AuthUser) {
    const scheduler = yield* Scheduler;
    yield* scheduler.runAfter(
      Duration.zero,
      refs.internal.customers.deletion.workflow.finalizeDeletedUserCleanup,
      {
        authId: authUser._id,
      }
    );
    yield* scheduler.runAfter(
      Duration.millis(ACCOUNT_DELETION_RECOVERY_DELAY_MS),
      refs.internal.customers.deletion.workflow.finalizeDeletedUserCleanup,
      {
        authId: authUser._id,
      }
    );
  }
);
const authFunctions: AuthFunctions = internal.auth.lifecycle;
export const authComponent = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  {
    authFunctions,
    local: {
      schema: authSchema,
    },
    verbose: false,
    triggers: {
      user: {
        onCreate: (ctx, authUser): Promise<void> =>
          createUser(authUser).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)
            ),
            runHook
          ),
        onUpdate: (ctx, newDoc, oldDoc): Promise<void> =>
          updateUser(newDoc, oldDoc).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)
            ),
            runHook
          ),
        onDelete: (ctx, authUser): Promise<void> =>
          scheduleDeletion(authUser).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)
            ),
            runHook
          ),
      },
    },
  }
);
