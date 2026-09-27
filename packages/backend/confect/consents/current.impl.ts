import { FunctionImpl, GroupImpl } from "@confect/server";
import { ANALYTICS_CONSENT_NOTICE_VERSION } from "@repo/analytics/consent";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  MutationCtx as MutationCtxService,
  QueryCtx as QueryCtxService,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import spec, {
  ConsentAccountChanged,
} from "@repo/backend/confect/consents/current.spec";
import {
  readCurrentConsent,
  saveCurrentConsent,
} from "@repo/backend/confect/consents/impl";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Effect, Layer } from "effect";

/** Returns one authenticated account's current consent decision. */
const get = FunctionImpl.make(
  databaseSchema,
  spec,
  "get",
  Effect.fn("consents.current.get")(function* (args) {
    const ctx = yield* QueryCtxService;
    const { appUser } = yield* requireAuth(ctx);
    const decision = yield* readCurrentConsent(ctx, appUser._id, args.category);
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
    const ctx = yield* MutationCtxService;
    const { appUser } = yield* requireAuth(ctx);
    if (appUser._id !== expectedUserId) {
      return yield* new ConsentAccountChanged({
        code: "CONSENT_ACCOUNT_CHANGED",
        message: "The active account changed before consent could be saved.",
      });
    }
    return yield* saveCurrentConsent(ctx, {
      ...decision,
      userId: appUser._id,
    });
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(get),
  Layer.provide(set),
  Layer.provide(atomic),
  GroupImpl.finalize
);
