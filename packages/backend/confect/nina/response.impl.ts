import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import { GatewayLive } from "@repo/backend/confect/gateway/live";
import { answerTurn } from "@repo/backend/confect/nina/answer";
import { captureMemory } from "@repo/backend/confect/nina/memory/capture";
import { generatePresentation } from "@repo/backend/confect/nina/presentation";
import spec from "@repo/backend/confect/nina/response.spec";
import { refreshSummary } from "@repo/backend/confect/nina/summary";
import { createUsageHandler } from "@repo/backend/confect/nina/usage";
import { Effect, Exit, Layer } from "effect";

const run = FunctionImpl.make(schema, spec, "run", answerTurn);

const present = FunctionImpl.make(
  schema,
  spec,
  "present",
  Effect.fn("nina.response.present")(function* (args) {
    const turn = yield* (yield* QueryRunner)
      .runQuery(refs.internal.nina.lifecycle.presentation, args)
      .pipe(Effect.orDie);
    if (!turn) {
      return null;
    }
    const usageHandler = yield* createUsageHandler(turn._id);
    // Title, suggestions, the rolling summary and memory capture are optional,
    // independent follow-up work. Each runs to its end whatever the others do,
    // because a step that dies would otherwise cancel the ones still running.
    // Their failures are raised together once all have ended, so none is lost.
    // The summary gets no usage handler: it is chat upkeep, so its tokens stay
    // on its own row (`NinaUpkeepCall`) and not in the ledger of the turn.
    yield* Effect.all(
      [
        Effect.exit(generatePresentation(turn, usageHandler)),
        Effect.exit(refreshSummary(turn)),
        Effect.exit(captureMemory(turn, usageHandler)),
      ],
      { concurrency: "unbounded" }
    ).pipe(
      Effect.flatMap(Exit.asVoidAll),
      Effect.provide(GatewayLive),
      Effect.catchTag("GatewayConfigurationError", () =>
        Effect.logWarning("Nina presentation configuration unavailable", {
          turnId: turn._id,
        })
      ),
      Effect.orDie
    );
    return null;
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(run),
  Layer.provide(present),
  GroupImpl.finalize
);
