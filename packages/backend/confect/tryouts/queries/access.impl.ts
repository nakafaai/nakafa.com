import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { anonymousStartAccess } from "@repo/backend/confect/tryouts/queries/access";
import spec from "@repo/backend/confect/tryouts/queries/access.spec";
import type { TryoutStartAccess } from "@repo/backend/confect/tryouts/start/spec";
import { Effect, Layer } from "effect";

/**
 * The advisory start state of a set: included for a Pro learner, a free attempt for anyone else. The plan
 * is the one billing projects from every Pro grant, a subscription, a pass, or a school, and the review
 * opens every answer by the same plan, so the start promises a Pro learner what the review shows.
 */
const getStartAccess = FunctionImpl.make(
  databaseSchema,
  spec,
  "getStartAccess",
  Effect.fn("tryouts.queries.access.getStartAccess")(function* () {
    const auth = yield* getOptionalAppUserForRead();
    if (!auth) {
      return anonymousStartAccess;
    }
    return {
      kind: auth.appUser.plan === "pro" ? "included" : "free-attempt",
    } satisfies TryoutStartAccess;
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getStartAccess),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
