import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  QueryCtx,
} from "@repo/backend/confect/_generated/services";
import {
  drainSeals,
  recordSealFailure,
} from "@repo/backend/confect/nina/sealed/drain";
import { readMessage } from "@repo/backend/confect/nina/sealed/message";
import { readThread } from "@repo/backend/confect/nina/sealed/thread";
import { sealTurn } from "@repo/backend/confect/nina/sealed/turn";
import spec from "@repo/backend/confect/nina/sealed.spec";
import { Array as Arr, Effect, Layer } from "effect";

/** One page of a thread's messages, opened for the owner of the thread (`readThread`). */
const thread = FunctionImpl.make(
  schema,
  spec,
  "thread",
  Effect.fn("nina.sealed.threadPage")(function* (args) {
    const ctx = yield* QueryCtx;
    return yield* readThread(ctx, args);
  })
);

/** One message of a thread, opened for its owner, or null (`readMessage`). */
const message = FunctionImpl.make(
  schema,
  spec,
  "message",
  Effect.fn("nina.sealed.messageRow")(function* ({ messageId, owner }) {
    const ctx = yield* QueryCtx;
    return yield* readMessage(ctx, owner, messageId);
  })
);

/** Seals the rows of one settled turn, or leaves it alone, and says what it cost (`sealTurn`). */
const seal = FunctionImpl.make(
  schema,
  spec,
  "seal",
  Effect.fn("nina.sealed.sealTurn")(function* ({ turnId }) {
    return { bytes: yield* sealTurn(turnId) };
  })
);

/** One page of the turns the drain may still seal, oldest first (`sealed/drain.ts`). */
const candidates = FunctionImpl.make(
  schema,
  spec,
  "candidates",
  Effect.fn("nina.sealed.candidates")(function* ({ cursor, numItems }) {
    const reader = yield* DatabaseReader;
    const page = yield* reader
      .table("ninaTurns")
      .index("by_phase_and_sealedAt_and_sealHold", (query) =>
        query
          .eq("phase", "settled")
          .eq("sealedAt", undefined)
          .eq("sealHold", undefined)
      )
      .paginate({ cursor, numItems })
      .pipe(Effect.orDie);
    return {
      continueCursor: page.continueCursor,
      ids: Arr.map(page.page, (turn) => turn._id),
      isDone: page.isDone,
    };
  })
);

/** Seals the settled turns within a byte budget, from an action (`sealed/drain.ts`). */
const drain = FunctionImpl.make(
  schema,
  spec,
  "drain",
  Effect.fn("nina.sealed.drain.run")(function* ({ budget }) {
    return yield* drainSeals(budget);
  })
);

/** Counts one failed seal on its turn and holds the turn after `SEAL_TRIES` (`sealed/drain.ts`). */
const recordFailure = FunctionImpl.make(
  schema,
  spec,
  "recordFailure",
  Effect.fn("nina.sealed.recordFailure")(function* ({ turnId }) {
    return yield* recordSealFailure(turnId);
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(thread),
  Layer.provide(message),
  Layer.provide(seal),
  Layer.provide(candidates),
  Layer.provide(drain),
  Layer.provide(recordFailure),
  GroupImpl.finalize
);
