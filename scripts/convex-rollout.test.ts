import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";
import {
  collectConvexApiReferences,
  findMissingConvexApiReferences,
  inspectConvexRollout,
} from "./convex-rollout.ts";

const REPOSITORY_ROOT = fileURLToPath(new URL("..", import.meta.url));

describe("Convex rollout policy", () => {
  it("collects complete generated API paths and imported aliases", () => {
    const source = `
      import { api as convexApi } from "@repo/backend/convex/_generated/api";
      import { api } from "unrelated";

      const current = convexApi.consents.current.get;
      const external = api.example.read;
    `;

    expect(collectConvexApiReferences("example.ts", source)).toEqual([
      {
        path: ["consents", "current", "get"],
        sourcePath: "example.ts",
      },
    ]);
  });

  it("rejects a function removal still referenced by the base website", () => {
    const references = collectConvexApiReferences(
      "consent.tsx",
      `
        import { api } from "@repo/backend/convex/_generated/api";
        const current = api.consents.queries.getCurrent;
      `
    );
    const missing = findMissingConvexApiReferences(
      references,
      (path) => path.join(".") === "consents.current.get"
    );

    expect(missing).toEqual([
      {
        path: ["consents", "queries", "getCurrent"],
        sourcePath: "consent.tsx",
      },
    ]);
  });

  it.live(
    "preserves every Convex function used by the base website",
    () =>
      Effect.gen(function* () {
        const references = yield* inspectConvexRollout(
          REPOSITORY_ROOT,
          "origin/main"
        ).pipe(Effect.provide(NodeServices.layer));

        expect(references.length).toBeGreaterThan(0);
      }),
    120_000
  );
});
