import { runMain } from "@effect/platform-node/NodeRuntime";
import { Effect } from "effect";
import { rendererManifest } from "@/lib/content/renderer/manifest";

runMain(
  rendererManifest.pipe(
    Effect.flatMap((manifest) =>
      Effect.sync(() => {
        process.stdout.write(`${JSON.stringify(manifest)}\n`);
      })
    )
  )
);
