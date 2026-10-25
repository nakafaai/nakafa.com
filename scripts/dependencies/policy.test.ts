import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Path } from "effect";
import { build } from "esbuild";
import { inspectDependencyPolicy } from "#scripts/dependencies/source";

const REPOSITORY_ROOT = fileURLToPath(new URL("../..", import.meta.url));

describe("dependency policy", () => {
  it.effect("accepts the actual repository dependency policy", () =>
    Effect.gen(function* () {
      const problems = yield* inspectDependencyPolicy(REPOSITORY_ROOT).pipe(
        Effect.provide(NodeServices.layer)
      );
      expect(problems).toEqual([]);
    })
  );

  // Convex bundles every component for the browser on push and codegen, and
  // fails the whole command on an unresolved import. posthog-node 5.56 and 5.57 import
  // @opentelemetry/api, an optional peer that is not installed, so the component
  // must keep the release pinned in package.json.
  it.effect("bundles the PostHog Convex component for the browser", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const backend = createRequire(
        path.join(REPOSITORY_ROOT, "packages/backend/package.json")
      );
      const component = path.dirname(
        backend.resolve("@posthog/convex/convex.config")
      );
      yield* Effect.tryPromise(() =>
        build({
          absWorkingDir: component,
          bundle: true,
          conditions: ["convex", "module"],
          define: { "process.env.NODE_ENV": '"production"' },
          entryPoints: ["crons.js", "lib.js", "version.js"],
          format: "esm",
          logLevel: "silent",
          outbase: component,
          outdir: "out",
          platform: "browser",
          splitting: true,
          target: "esnext",
          write: false,
        })
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
