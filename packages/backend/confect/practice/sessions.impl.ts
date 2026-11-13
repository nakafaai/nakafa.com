import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  getOptionalAppUserForRead,
  requireAuth,
} from "@repo/backend/confect/auth/session";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import {
  checkPracticeAnswer,
  readPracticeContent,
  readPracticeExplanation,
  readPracticeState,
} from "@repo/backend/confect/practice/answer";
import {
  openPracticeSession,
  restartPracticeSession,
} from "@repo/backend/confect/practice/session";
import spec from "@repo/backend/confect/practice/sessions.spec";
import { Clock, Effect, Layer } from "effect";

/** Opens the caller's practice of one section, or the one they hold. */
const open = FunctionImpl.make(
  databaseSchema,
  spec,
  "open",
  Effect.fn("practice.sessions.open")(function* (args) {
    const { appUser } = yield* requireAuth();
    const sessionId = yield* openPracticeSession(
      appUser._id,
      args,
      yield* Clock.currentTimeMillis
    );
    return { sessionId };
  })
);

/** Starts the caller's practice again. */
const restart = FunctionImpl.make(
  databaseSchema,
  spec,
  "restart",
  Effect.fn("practice.sessions.restart")(function* (args) {
    const { appUser } = yield* requireAuth();
    const sessionId = yield* restartPracticeSession(
      appUser._id,
      args.sessionId,
      yield* Clock.currentTimeMillis
    );
    return { sessionId };
  })
);

/** Checks one question of the caller's practice. */
const check = FunctionImpl.make(
  databaseSchema,
  spec,
  "check",
  Effect.fn("practice.sessions.check")(function* (args) {
    const { appUser } = yield* requireAuth();
    return yield* checkPracticeAnswer(
      appUser._id,
      args.questionId,
      args.response,
      yield* Clock.currentTimeMillis
    );
  })
);

/** The caller's practice of one section, or none for a visitor or before they open it. */
const state = FunctionImpl.make(
  databaseSchema,
  spec,
  "state",
  Effect.fn("practice.sessions.state")(function* (args) {
    const auth = yield* getOptionalAppUserForRead();
    if (!auth) {
      return null;
    }
    return yield* readPracticeState(auth.appUser._id, args);
  })
);

/** The bodies of the caller's session's questions. */
const content = FunctionImpl.make(
  databaseSchema,
  spec,
  "content",
  Effect.fn("practice.sessions.content")(function* (args) {
    const { appUser } = yield* requireAuth();
    return yield* readPracticeContent(appUser._id, args.sessionId, args.locale);
  })
);

/** A checked question's key and explanation, for a reader who may read them. */
const explain = FunctionImpl.make(
  databaseSchema,
  spec,
  "explain",
  Effect.fn("practice.sessions.explain")(function* (args) {
    const auth = yield* getOptionalAppUserForRead();
    if (!auth) {
      return null;
    }
    return yield* readPracticeExplanation(
      auth.appUser._id,
      args.questionId,
      args.locale
    ).pipe(Effect.catchTag("PracticeError", () => Effect.succeed(null)));
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(open),
  Layer.provide(restart),
  Layer.provide(check),
  Layer.provide(state),
  Layer.provide(content),
  Layer.provide(explain),
  Layer.provide(atomic),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
