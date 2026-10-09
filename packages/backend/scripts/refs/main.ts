import { runMain } from "@effect/platform-node/NodeRuntime";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { generateRefs } from "@repo/backend/scripts/refs/generate";
import { Effect, Path } from "effect";

/** Regenerates the per-domain refs of this backend package from its assembled spec. */
const main = Effect.gen(function* () {
  const path = yield* Path.Path;
  const backendRoot = path.resolve(
    yield* path.fromFileUrl(new URL("../../", import.meta.url))
  );
  const generated = path.join(backendRoot, "confect", "_generated");
  yield* generateRefs({
    backendRoot,
    outputDirectory: path.join(generated, "refs"),
    specPath: path.join(generated, "spec.ts"),
  });
});

runMain(main.pipe(Effect.provide(nodeServicesLayer)));
