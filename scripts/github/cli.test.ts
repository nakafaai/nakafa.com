import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem } from "effect";
import { validateCliWorkflow, verifyCliWorkflow } from "#scripts/github/cli";

const WORKFLOW_PATH = fileURLToPath(
  new URL("../../.github/workflows/cli-publish.yml", import.meta.url)
);

const readWorkflow = Effect.fn("GithubCliTest.readWorkflow")(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  return yield* fileSystem.readFileString(WORKFLOW_PATH);
});

describe("CLI workflow policy", () => {
  it.effect("accepts isolated exact-byte OIDC publication", () =>
    Effect.gen(function* () {
      const source = yield* readWorkflow();
      yield* verifyCliWorkflow(source);
      expect(validateCliWorkflow(source)).toEqual([]);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("rejects credentials and expanded publishing identity", () =>
    Effect.gen(function* () {
      const source = yield* readWorkflow();
      expect(
        validateCliWorkflow(`${source}\nNODE_AUTH_TOKEN: secret`)
      ).toContain(
        "CLI workflow contains forbidden credential: NODE_AUTH_TOKEN"
      );
      expect(
        validateCliWorkflow(
          source.replace(
            "      contents: read",
            "      contents: read\n      id-token: write"
          )
        )
      ).toContain("Exactly one isolated job must receive npm OIDC identity.");
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("rejects unverified archives and provenance", () =>
    Effect.gen(function* () {
      const source = yield* readWorkflow();
      expect(
        validateCliWorkflow(
          source.replaceAll("EXPECTED_SHA256", "UNVERIFIED_SHA256")
        )
      ).not.toEqual([]);
      expect(
        validateCliWorkflow(
          source.replace("audit signatures --json", "audit --json")
        )
      ).not.toEqual([]);
      expect(
        validateCliWorkflow(
          source.replace("environment: npm-production", "environment: test")
        )
      ).not.toEqual([]);
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
