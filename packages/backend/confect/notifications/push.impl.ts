import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import session from "@repo/backend/confect/middleware/session.impl";
import spec from "@repo/backend/confect/notifications/push.spec";
import { SUBSCRIPTION_LIMIT } from "@repo/backend/confect/notifications/subscription";
import { Array as Arr, Clock, Effect, Layer, Option } from "effect";

/** The stored subscription of an endpoint, whichever account holds it. */
const byEndpoint = Effect.fn("notifications.push.byEndpoint")(function* (
  endpoint: string
) {
  return yield* (yield* DatabaseReader)
    .table("pushSubscriptions")
    .index("by_endpoint", (query) => query.eq("endpoint", endpoint))
    .first()
    .pipe(Effect.orDie);
});

/**
 * Stores the browser's subscription for the signed-in account, or refreshes it
 * when the browser subscribed before, under whichever account. An account keeps
 * at most SUBSCRIPTION_LIMIT browsers, and the oldest one goes first.
 */
const subscribe = FunctionImpl.make(
  databaseSchema,
  spec,
  "subscribe",
  Effect.fn("notifications.push.subscribe")(function* (keys) {
    const { appUser } = yield* requireAuth();
    const writer = (yield* DatabaseWriter).table("pushSubscriptions");
    const createdAt = yield* Clock.currentTimeMillis;
    const existing = yield* byEndpoint(keys.endpoint);
    if (Option.isSome(existing)) {
      yield* writer
        .replace(existing.value._id, {
          ...keys,
          createdAt,
          userId: appUser._id,
        })
        .pipe(Effect.orDie);
      return null;
    }
    const held = yield* (yield* DatabaseReader)
      .table("pushSubscriptions")
      .index("by_userId", (query) => query.eq("userId", appUser._id))
      .take(SUBSCRIPTION_LIMIT)
      .pipe(Effect.orDie);
    yield* Effect.forEach(
      Arr.take(held, held.length - SUBSCRIPTION_LIMIT + 1),
      (oldest) => writer.delete(oldest._id).pipe(Effect.orDie),
      { discard: true }
    );
    yield* writer
      .insert({ ...keys, createdAt, userId: appUser._id })
      .pipe(Effect.orDie);
    return null;
  })
);

/** Forgets the browser's subscription when the signed-in account holds it. */
const unsubscribe = FunctionImpl.make(
  databaseSchema,
  spec,
  "unsubscribe",
  Effect.fn("notifications.push.unsubscribe")(function* ({ endpoint }) {
    const { appUser } = yield* requireAuth();
    const existing = Option.filter(
      yield* byEndpoint(endpoint),
      (found) => found.userId === appUser._id
    );
    if (Option.isSome(existing)) {
      yield* (yield* DatabaseWriter)
        .table("pushSubscriptions")
        .delete(existing.value._id)
        .pipe(Effect.orDie);
    }
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(subscribe),
  Layer.provide(unsubscribe),
  Layer.provide(session),
  GroupImpl.finalize
);
