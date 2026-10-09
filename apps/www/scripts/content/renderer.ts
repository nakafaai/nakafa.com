import { runMain } from "@effect/platform-node/NodeRuntime";
import { JsonTextSchema } from "@repo/utilities/json";
import { Effect, Schema } from "effect";
import { rendererManifest } from "@/lib/content/renderer/manifest";

runMain(
  rendererManifest.pipe(
    Effect.flatMap((manifest) =>
      Schema.encodeEffect(JsonTextSchema)(manifest).pipe(Effect.orDie)
    ),
    Effect.flatMap((json) =>
      Effect.sync(() => {
        process.stdout.write(`${json}\n`);
      })
    )
  )
);
