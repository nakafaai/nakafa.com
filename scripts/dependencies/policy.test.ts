import { createRequire } from "node:module";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Path } from "effect";
import { build } from "esbuild";
import { inspectDependencyPolicy } from "#scripts/dependencies/source";

/** The repository root, two folders above this test. */
const REPOSITORY_ROOT = `${import.meta.dirname}/../..`;

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
  // fails the whole command on an unresolved import. posthog-node 5.56 to 5.57.1
  // imported @opentelemetry/api, an optional peer that is not installed; 5.57.2 and
  // later read its global symbol instead. @posthog/convex depends on posthog-node
  // ^5.67.1, so the component keeps its own 5.x copy while the analytics package
  // runs 6.x, and this test bundles the copy the component resolves.
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
