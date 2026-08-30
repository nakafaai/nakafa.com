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
  it.effect("accepts isolated publication and unprivileged verification", () =>
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
        ).includes("build must not receive npm OIDC identity.")
      );

      const movedIdentity = source
        .replace("    permissions:\n      id-token: write\n", "")
        .concat(
          "\n  unrelated:\n    runs-on: ubuntu-latest\n    permissions:\n      id-token: write\n    steps: []\n"
        );
      const movedProblems = validateCliWorkflow(movedIdentity);
      assert.ok(
        movedProblems.includes(
          "Only the publish job must receive npm OIDC identity."
        )
      );
      assert.ok(
        movedProblems.includes("unrelated must not receive npm OIDC identity.")
      );

      const movedEnvironment = source
        .replace("    environment: npm-production", "    environment: test")
        .concat("\n# environment: npm-production\n");
      assert.ok(
        validateCliWorkflow(movedEnvironment).includes(
          "CLI publication must use the protected npm-production environment."
        )
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("binds release contracts to executable decoded steps", () =>
    Effect.gen(function* () {
      const source = yield* readWorkflow();
      const disabledVerifier = source
        .replace(
          '          node "$VERIFIER" \\',
          '          true # node "$VERIFIER" \\'
        )
        .concat('\n# node "$VERIFIER"\n');
      const verifierProblems = validateCliWorkflow(disabledVerifier);
      assert.ok(
        verifierProblems.includes(
          'CLI verify job is missing required contract: node "$VERIFIER"'
        )
      );
      assert.ok(
        verifierProblems.includes(
          "CLI verification must execute one transported verifier."
        )
      );

      const privilegedVerifier = source.replace(
        '          npx --yes "$NPM_CLI" publish "$TARBALL" \\',
        '          node "$VERIFIER"\n          npx --yes "$NPM_CLI" publish "$TARBALL" \\'
      );
      const privilegedProblems = validateCliWorkflow(privilegedVerifier);
      assert.ok(
        privilegedProblems.includes(
          "CLI publication may execute only one npm publish command."
        )
      );
      assert.ok(
        privilegedProblems.includes(
          "CLI publication must not receive the verifier artifact."
        )
      );

      const siblingDecoy = source
        .replace("          pnpm --filter @nakafa/cli build", "          true")
        .concat(
          "\n  unrelated:\n    runs-on: ubuntu-latest\n    steps:\n      - run: pnpm --filter @nakafa/cli build\n"
        );
      assert.ok(
        validateCliWorkflow(siblingDecoy).includes(
          "CLI build job is missing required contract: pnpm --filter @nakafa/cli build"
        )
      );

      const shellComment = source.replace(
        "          pnpm --filter @nakafa/cli typecheck",
        "          # pnpm --filter @nakafa/cli typecheck"
      );
      assert.ok(
        validateCliWorkflow(shellComment).includes(
          "CLI build job is missing required contract: pnpm --filter @nakafa/cli typecheck"
        )
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
          source.replace("needs: [build, publish]", "needs: publish")
        ).includes("CLI verification must consume build and publication.")
      );
      assert.ok(
        validateCliWorkflow(
          source.replace(
            "    permissions: {}\n    steps:\n      - name: Download verified package",
            "    permissions:\n      contents: read\n    steps:\n      - name: Download verified package"
          )
        ).includes("CLI verification permissions must remain empty.")
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
