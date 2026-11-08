import { layerSecureRandom } from "@effect/platform-node/NodeCrypto";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { localConvexLayer } from "@repo/backend/scripts/content/acceptance/convex";
import { FetchClient } from "@repo/utilities/http/client";
import { Effect, FileSystem, Layer, Path } from "effect";

/** The repository root, whose prepared acceptance runtime the browser tests reach. */
const repositoryRoot = new URL("../../../../", import.meta.url);

/**
 * The running acceptance runtime of this checkout, reached from the test's own
 * process: its local backend over HTTP as its admin, with the random bytes,
 * files and paths that a fixture uses. A fixture is one call in this process,
 * where the acceptance command line started a process for itself and one for
 * each Convex call it made.
 */
const acceptanceLayer = Layer.unwrap(
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const root = yield* (yield* FileSystem.FileSystem).realPath(
      yield* path.fromFileUrl(repositoryRoot)
    );
    return localConvexLayer(root);
  })
).pipe(
  Layer.merge(layerSecureRandom),
  Layer.provideMerge(Layer.merge(nodeServicesLayer, FetchClient))
);

/**
 * Runs one acceptance fixture, such as `seedLearner` or `seedSchool`, against
 * the running local runtime, in this process. It reaches only the local backend
 * that the runtime's manifest names, never a cloud deployment.
 */
export const runFixture = <A, E, R>(fixture: Effect.Effect<A, E, R>) =>
  fixture.pipe(Effect.provide(acceptanceLayer));
