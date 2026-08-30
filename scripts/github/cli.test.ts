import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
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
      assert.deepStrictEqual(validateCliWorkflow(source), []);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("rejects credentials and expanded publishing identity", () =>
    Effect.gen(function* () {
      const source = yield* readWorkflow();
      assert.ok(
        validateCliWorkflow(`${source}\nNODE_AUTH_TOKEN: secret`).includes(
          "CLI workflow contains forbidden credential: NODE_AUTH_TOKEN"
        )
      );
      assert.ok(
        validateCliWorkflow(
          source.replace(
            "      contents: read",
            "      contents: read\n      id-token: write"
          )
        ).includes("Exactly one isolated job must receive npm OIDC identity.")
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("rejects unverified archives and provenance", () =>
    Effect.gen(function* () {
      const source = yield* readWorkflow();
      assert.ok(
        validateCliWorkflow(
          source.replaceAll("EXPECTED_SHA256", "UNVERIFIED_SHA256")
        ).length > 0
      );
      assert.ok(
        validateCliWorkflow(
          source.replaceAll(
            "EXPECTED_VERIFIER_SHA256",
            "UNVERIFIED_VERIFIER_SHA256"
          )
        ).length > 0
      );
      assert.ok(
        validateCliWorkflow(
          source.replace("audit signatures --json", "audit --json")
        ).length > 0
      );
      assert.ok(
        validateCliWorkflow(
          source.replace("environment: npm-production", "environment: test")
        ).length > 0
      );
      assert.ok(
        validateCliWorkflow(`${source}\n@base64d`).includes(
          "CLI workflow contains unauthenticated provenance parsing: @base64d"
        )
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
