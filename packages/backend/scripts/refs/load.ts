import { getUnknownMessage } from "@repo/backend/scripts/lib/errors";
import { RefsLoadError } from "@repo/backend/scripts/refs/errors";
import { asLeafGroup } from "@repo/backend/scripts/refs/leaf";
import { Effect, Path } from "effect";
import { createServer, type ViteDevServer } from "vite";

/**
 * Starts Vite's module loader for the backend package, with the `@repo` alias of
 * the repository's Vitest configuration. Native Node cannot load the leaf graph,
 * because generated tables import without extensions, and tsx compiles workspace
 * packages without `type: module` as CommonJS. Vite loads the graph as the tests do.
 */
const startLoader = Effect.fn("RefsLoad.startLoader")(function* (
  backendRoot: string
) {
  const path = yield* Path.Path;
  return yield* Effect.promise(() =>
    createServer({
      appType: "custom",
      configFile: false,
      logLevel: "silent",
      optimizeDeps: { include: [], noDiscovery: true },
      resolve: { alias: { "@repo": path.resolve(backendRoot, "..") } },
      root: backendRoot,
      server: { hmr: false, middlewareMode: true, watch: null, ws: false },
    })
  );
});

/** Loads one leaf spec module and returns the group it default-exports. */
const loadLeafGroup = Effect.fn("RefsLoad.loadLeafGroup")(function* (
  server: ViteDevServer,
  file: string,
  specifier: string
) {
  const moduleExports = yield* Effect.tryPromise({
    try: () => server.ssrLoadModule(file),
    catch: (cause) =>
      new RefsLoadError({
        message: `Unable to load ${specifier}: ${getUnknownMessage(cause)}`,
      }),
  });
  return yield* asLeafGroup(specifier, moduleExports);
});

/**
 * Loads the group of every leaf that the spec imports. Each specifier is relative
 * to the spec's folder, such as `../nina/turns.spec`, and the groups keep its order.
 */
export const loadLeafGroups = Effect.fn("RefsLoad.loadLeafGroups")(function* (
  backendRoot: string,
  specDirectory: string,
  specifiers: readonly string[]
) {
  const path = yield* Path.Path;
  return yield* Effect.acquireUseRelease(
    startLoader(backendRoot),
    (server) =>
      Effect.forEach(specifiers, (specifier) =>
        loadLeafGroup(
          server,
          path.resolve(specDirectory, `${specifier}.ts`),
          specifier
        )
      ),
    (server) => Effect.promise(() => server.close())
  );
});
