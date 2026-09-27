import { FunctionImpl, GroupImpl } from "@confect/server";
import { ANALYTICS_CONSENT_NOTICE_VERSION } from "@repo/analytics/consent";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { requireAuth } from "@repo/backend/confect/auth/session";
import spec, {
  ConsentAccountChanged,
} from "@repo/backend/confect/consents/current.spec";
import {
  readCurrentConsent,
  saveCurrentConsent,
} from "@repo/backend/confect/consents/impl";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer } from "effect";

/** Returns one authenticated account's current consent decision. */
const get = FunctionImpl.make(
  databaseSchema,
  spec,
  "get",
  Effect.fn("consents.current.get")(function* (args) {
    const { appUser } = yield* requireAuth();
    const decision = yield* readCurrentConsent(appUser._id, args.category);
    return {
      currentNoticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
      decision,
    };
  })
);
const set = FunctionImpl.make(
  databaseSchema,
  spec,
  "set",
  Effect.fn("consents.current.set")(function* ({ decision, expectedUserId }) {
    const { appUser } = yield* requireAuth();
    if (appUser._id !== expectedUserId) {
      return yield* new ConsentAccountChanged({
        code: "CONSENT_ACCOUNT_CHANGED",
        message: "The active account changed before consent could be saved.",
      });
    }
    return yield* saveCurrentConsent({
      ...decision,
      userId: appUser._id,
    });
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(get),
  Layer.provide(set),
  Layer.provide(atomic),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
