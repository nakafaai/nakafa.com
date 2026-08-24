import { describe, expect, it } from "@repo/testing/effect";
import { Effect, Result } from "effect";
import {
  collectConvexApiReferences,
  findMissingConvexApiReferences,
} from "./source.ts";

describe("Convex rollout source", () => {
  it.effect("collects complete property and element access paths", () =>
    Effect.gen(function* () {
      const references = yield* collectConvexApiReferences(
        "example.ts",
        `
          import { api as convexApi } from "@repo/backend/convex/_generated/api";
          import { api } from "unrelated";

          const current = convexApi.consents["current"].get;
          const external = api.example.read;
        `
      );

      expect(references).toEqual([
        {
          path: ["consents", "current", "get"],
          sourcePath: "example.ts",
        },
      ]);
    })
  );

  it.effect("rejects syntax that can hide a generated API reference", () =>
    Effect.gen(function* () {
      const sources = [
        `import * as convex from "@repo/backend/convex/_generated/api"; void convex.api;`,
        `import { api } from "@repo/backend/convex/_generated/api"; const { consents } = api;`,
        `import { api } from "@repo/backend/convex/_generated/api"; const key = "get"; void api.consents.current[key];`,
      ];

      for (const source of sources) {
        const result = yield* collectConvexApiReferences(
          "unsupported.ts",
          source
        ).pipe(Effect.result);
        expect(Result.isFailure(result)).toBe(true);
        if (Result.isSuccess(result)) {
          continue;
        }
        expect(result.failure._tag).toBe("ConvexRolloutSourceError");
      }
    })
  );

  it("reports a removed function used by deployed source", () => {
    const references = [
      {
        path: ["consents", "queries", "getCurrent"],
        sourcePath: "consent.tsx",
      },
    ];
    const missing = findMissingConvexApiReferences(
      references,
      (path) => path.join(".") === "consents.current.get"
    );

    expect(missing).toEqual(references);
  });
});
