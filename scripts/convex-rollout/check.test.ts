import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";
import { inspectConvexRollout, localDeployments } from "./check.ts";

const REPOSITORY_ROOT = fileURLToPath(new URL("../..", import.meta.url));

describe("Convex rollout check", () => {
  it.live(
    "preserves every Convex function used by the local baseline consumers",
    () =>
      Effect.gen(function* () {
        const references = yield* inspectConvexRollout(
          REPOSITORY_ROOT,
          localDeployments("origin/main")
        ).pipe(Effect.provide(NodeServices.layer));

        expect(references.length).toBeGreaterThan(0);
        expect(new Set(references.map(({ consumer }) => consumer))).toEqual(
          new Set(["www", "api", "mcp"])
        );
      }),
    120_000
  );
});
