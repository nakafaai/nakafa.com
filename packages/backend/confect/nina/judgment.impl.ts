import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import { GatewayLive } from "@repo/backend/confect/gateway/live";
import { judgments } from "@repo/backend/confect/nina/judgment/catalog";
import { measureTexts } from "@repo/backend/confect/nina/judgment/measure";
import spec from "@repo/backend/confect/nina/judgment.spec";
import { Effect, Layer, Record as Rec } from "effect";

/** Measures the judgments on some texts, with the thresholds this deployment holds. */
const measure = FunctionImpl.make(
  schema,
  spec,
  "measure",
  Effect.fn("nina.judgment.measure")(function* ({ texts, together }) {
    return {
      rows: yield* measureTexts(texts, together).pipe(
        Effect.provide(GatewayLive)
      ),
      thresholds: Rec.map(judgments, ({ threshold }) => threshold),
    };
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(measure),
  GroupImpl.finalize
);
