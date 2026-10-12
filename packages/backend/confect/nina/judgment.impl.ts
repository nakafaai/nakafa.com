import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import { GatewayLive } from "@repo/backend/confect/gateway/live";
import { judgments } from "@repo/backend/confect/nina/judgment/catalog";
import { measureTexts } from "@repo/backend/confect/nina/judgment/measure";
import spec from "@repo/backend/confect/nina/judgment.spec";
import { Effect, Layer, Record as Rec, Struct } from "effect";

/** Measures the named judgments on some texts, with the thresholds this deployment holds for them. */
const measure = FunctionImpl.make(
  schema,
  spec,
  "measure",
  Effect.fn("nina.judgment.measure")(function* ({ names, texts, together }) {
    return {
      rows: yield* measureTexts(names, texts, together).pipe(
        Effect.provide(GatewayLive)
      ),
      thresholds: Rec.map(
        Struct.pick(judgments, names),
        ({ threshold }) => threshold
      ),
    };
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(measure),
  GroupImpl.finalize
);
