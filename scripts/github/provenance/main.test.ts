import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Sink, Stdio } from "effect";
import { ProvenanceBundleVerifier } from "#scripts/github/provenance/bundle";
import { verifyProvenanceAudit } from "#scripts/github/provenance/main";

const SLSA_PREDICATE = "https://slsa.dev/provenance/v1";
const PACKAGE_SHA512 = "ab".repeat(64);
const REPOSITORY = "https://github.com/nakafaai/nakafa.com";
const SOURCE_SHA = "0123456789abcdef0123456789abcdef01234567";
const WORKFLOW = ".github/workflows/cli-publish.yml";
const BUNDLE = { evidence: "signed" };

const AUDIT = JSON.stringify({
  invalid: [],
  missing: [],
  verified: [
    {
      attestationBundles: [{ bundle: BUNDLE, predicateType: SLSA_PREDICATE }],
      attestations: {
        provenance: { predicateType: SLSA_PREDICATE },
        url: "https://registry.npmjs.org/-/npm/v1/attestations/@nakafa%2fcli@0.1.0",
      },
      name: "@nakafa/cli",
      version: "0.1.0",
    },
  ],
});

const STATEMENT = JSON.stringify({
  _type: "https://in-toto.io/Statement/v1",
  predicate: {
    buildDefinition: {
      buildType:
        "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1",
      externalParameters: {
        workflow: {
          path: WORKFLOW,
          ref: "refs/heads/main",
          repository: REPOSITORY,
        },
      },
      resolvedDependencies: [
        {
          digest: { gitCommit: SOURCE_SHA },
          uri: `git+${REPOSITORY}@refs/heads/main`,
        },
      ],
    },
    runDetails: {
      builder: { id: "https://github.com/actions/runner/github-hosted" },
    },
  },
  predicateType: SLSA_PREDICATE,
  subject: [
    {
      digest: { sha512: PACKAGE_SHA512 },
      name: "pkg:npm/%40nakafa/cli@0.1.0",
    },
  ],
});

/** Builds the exact verifier CLI arguments for one audit file. */
const cliArguments = (auditPath: string) => [
  auditPath,
  "@nakafa/cli",
  "0.1.0",
  PACKAGE_SHA512,
  REPOSITORY,
  WORKFLOW,
  "refs/heads/main",
  SOURCE_SHA,
  "npm-production",
];

/** Runs the CLI program with a recorded signer and captured output. */
const runVerifier = Effect.fn("ProvenanceMainTest.runVerifier")(function* (
  argv: readonly string[]
) {
  const signed: unknown[] = [];
  const stdout: Array<string | Uint8Array> = [];
  const result = yield* verifyProvenanceAudit(argv).pipe(
    Effect.provide(
      Layer.mergeAll(
        Layer.succeed(ProvenanceBundleVerifier, {
          verify: (bundle, identity) =>
            Effect.sync(() => {
              signed.push([bundle, identity]);
              return STATEMENT;
            }),
        }),
        Stdio.layerTest({
          stdout: () =>
            Sink.forEachArray((chunks) =>
              Effect.sync(() => {
                stdout.push(...chunks);
              })
            ),
        })
      )
    ),
    Effect.result
  );
  return { result, signed, stdout };
});

describe("provenance verifier CLI", () => {
  it.effect("verifies the transported audit for the exact publisher", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const auditPath = yield* fileSystem.makeTempFileScoped({
        prefix: "provenance-audit-",
      });
      yield* fileSystem.writeFileString(auditPath, AUDIT);

      const { result, signed, stdout } = yield* runVerifier(
        cliArguments(auditPath)
      );

      assert.strictEqual(result._tag, "Success");
      assert.deepStrictEqual(signed, [
        [
          BUNDLE,
          {
            environment: "npm-production",
            packageName: "@nakafa/cli",
            packageSha512: PACKAGE_SHA512,
            packageVersion: "0.1.0",
            ref: "refs/heads/main",
            repository: REPOSITORY,
            sourceSha: SOURCE_SHA,
            workflow: WORKFLOW,
          },
        ],
      ]);
      assert.deepStrictEqual(stdout, [
        "Verified @nakafa/cli@0.1.0 with exact trusted-publisher provenance.\n",
      ]);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("rejects invalid arguments and unreadable audits", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "provenance-missing-",
      });
      const invalid = yield* runVerifier([
        ...cliArguments(`${directory}/audit.json`).slice(0, -1),
        "npm-staging",
      ]);
      const missing = yield* runVerifier(
        cliArguments(`${directory}/audit.json`)
      );

      assert.deepStrictEqual(
        [invalid, missing].map(({ result, signed, stdout }) => [
          result._tag === "Failure" ? result.failure.message : result._tag,
          signed,
          stdout,
        ]),
        [
          ["Provenance verification arguments are invalid.", [], []],
          ["Unable to read the npm signature audit.", [], []],
        ]
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
