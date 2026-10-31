import { runMain } from "@effect/platform-node/NodeRuntime";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { markModules } from "@repo/backend/scripts/reuse/mark";
import { Effect, Path } from "effect";

/** Marks the Convex modules of this backend package after Confect has written them. */
const main = Effect.gen(function* () {
  const path = yield* Path.Path;
  const backendRoot = path.resolve(
    yield* path.fromFileUrl(new URL("../../", import.meta.url))
  );
  yield* markModules(path.join(backendRoot, "convex"));
});

runMain(main.pipe(Effect.provide(nodeServicesLayer)));
