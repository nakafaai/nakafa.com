import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import { GatewayLive } from "@repo/backend/confect/gateway/live";
import { buildPortrait } from "@repo/backend/confect/nina/portrait/build";
import spec from "@repo/backend/confect/nina/portrait/build.spec";
import { Effect, Layer } from "effect";

const run = FunctionImpl.make(
  schema,
  spec,
  "run",
  Effect.fn("nina.portrait.run")(function* ({ userId }) {
    yield* buildPortrait(userId).pipe(
      Effect.provide(GatewayLive),
      Effect.catchTag("GatewayConfigurationError", () =>
        Effect.logWarning("Nina portrait configuration unavailable")
      )
    );
    return null;
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(run),
  GroupImpl.finalize
);
