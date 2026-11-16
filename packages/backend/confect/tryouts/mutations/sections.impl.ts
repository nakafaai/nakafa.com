import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { requireAuth } from "@repo/backend/confect/auth/session";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { tryoutGate } from "@repo/backend/confect/tryouts/gate";
import { countQuestionLook } from "@repo/backend/confect/tryouts/language";
import spec, {
  SECTION_COMPLETED_RESULT,
} from "@repo/backend/confect/tryouts/mutations/sections.spec";
import { chooseSectionLanguage } from "@repo/backend/confect/tryouts/runtime/section/start";
import { Clock, Effect, Layer } from "effect";

/** Opens one section of the caller's attempt through the live-attempt gate. */
const start = FunctionImpl.make(
  databaseSchema,
  spec,
  "start",
  Effect.fn("tryouts.mutations.sections.start")(function* (args) {
    const { appUser } = yield* requireAuth();
    return yield* tryoutGate.startSection(appUser._id, args);
  })
);

const completed = Object.freeze({ kind: SECTION_COMPLETED_RESULT });

/** Ends and scores the caller's running section through the live-attempt gate. */
const complete = FunctionImpl.make(
  databaseSchema,
  spec,
  "complete",
  Effect.fn("tryouts.mutations.sections.complete")(function* (args) {
    const { appUser } = yield* requireAuth();
    yield* tryoutGate.finish(appUser._id, args);
    return completed;
  })
);
/**
 * Switches the language the caller's section shows its questions in. It reads no clock of the
 * section, so a learner may switch in the review too.
 */
const chooseQuestionLanguage = FunctionImpl.make(
  databaseSchema,
  spec,
  "chooseQuestionLanguage",
  Effect.fn("tryouts.mutations.sections.chooseQuestionLanguage")(
    function* (args) {
      const { appUser } = yield* requireAuth();
      yield* chooseSectionLanguage({
        ...args,
        now: yield* Clock.currentTimeMillis,
        userId: appUser._id,
      });
      return null;
    }
  )
);
/** Counts the caller's look at one question in another language, for the authors' review. */
const countLook = FunctionImpl.make(
  databaseSchema,
  spec,
  "countQuestionLook",
  Effect.fn("tryouts.mutations.sections.countQuestionLook")(function* (args) {
    const { appUser } = yield* requireAuth();
    yield* countQuestionLook({
      ...args,
      now: yield* Clock.currentTimeMillis,
      userId: appUser._id,
    });
    return null;
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(countLook),
  Layer.provide(start),
  Layer.provide(complete),
  Layer.provide(chooseQuestionLanguage),
  Layer.provide(atomic),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
