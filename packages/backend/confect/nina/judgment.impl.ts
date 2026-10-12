import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import { GatewayLive } from "@repo/backend/confect/gateway/live";
import { judgments } from "@repo/backend/confect/nina/judgment/catalog";
import { measureTexts } from "@repo/backend/confect/nina/judgment/measure";
import spec, {
  type measureResultValidator,
} from "@repo/backend/confect/nina/judgment.spec";
import { Effect, Layer, Record as Rec, Struct } from "effect";

type Failed = Extract<typeof measureResultValidator.Type, { kind: "failed" }>;

/** Answers with the failure that ended the call, which the measuring command reports as its reason. */
const failed = (failure: Failed["failure"]) =>
  Effect.succeed<Failed>({ failure, kind: "failed" });

/** Measures the named judgments on some texts, with the thresholds this deployment holds for them. */
const measure = FunctionImpl.make(
  schema,
  spec,
  "measure",
  Effect.fn("nina.judgment.measure")(function* ({ names, texts, together }) {
    return yield* measureTexts(names, texts, together).pipe(
      Effect.provide(GatewayLive),
      Effect.map((rows) => ({
        kind: "measured" as const,
        rows,
        thresholds: Rec.map(
          Struct.pick(judgments, names),
          ({ threshold }) => threshold
        ),
      })),
      Effect.catchTag("GatewayConfigurationError", failed)
    );
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(measure),
  GroupImpl.finalize
);
