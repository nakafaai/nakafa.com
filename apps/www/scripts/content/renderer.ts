import { runMain } from "@effect/platform-node/NodeRuntime";
import { Effect, Schema } from "effect";
import { rendererManifest } from "@/lib/content/renderer/manifest";

const CompactJsonSchema = Schema.fromJsonString(Schema.Unknown);

runMain(
  rendererManifest.pipe(
    Effect.flatMap((manifest) =>
      Schema.encodeEffect(CompactJsonSchema)(manifest).pipe(Effect.orDie)
    ),
    Effect.flatMap((json) =>
      Effect.sync(() => {
        process.stdout.write(`${json}\n`);
      })
    )
  )
);
