import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer, Result } from "effect";
import { ProvenanceBundleVerifier } from "#scripts/github/provenance/bundle";
import type { ProvenanceExpectation } from "#scripts/github/provenance/schema";
import { verifyProvenance } from "#scripts/github/provenance/verify";

const EXPECTATION = {
  environment: "npm-production",
  packageName: "@nakafa/cli",
  packageSha512:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  packageVersion: "0.1.0",
  ref: "refs/heads/main",
  repository: "https://github.com/nakafaai/nakafa.com",
  sourceSha: "0123456789abcdef0123456789abcdef01234567",
  workflow: ".github/workflows/cli-publish.yml",
} satisfies ProvenanceExpectation;

const BUNDLE = { evidence: "signed" };

function statement(sourceSha = EXPECTATION.sourceSha) {
  return JSON.stringify({
    _type: "https://in-toto.io/Statement/v1",
    predicate: {
      buildDefinition: {
        buildType:
          "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1",
        externalParameters: {
          workflow: {
            path: EXPECTATION.workflow,
            ref: EXPECTATION.ref,
            repository: EXPECTATION.repository,
          },
        },
        resolvedDependencies: [
          {
            digest: { gitCommit: sourceSha },
            uri: `git+${EXPECTATION.repository}@${EXPECTATION.ref}`,
          },
        ],
      },
      runDetails: {
        builder: {
          id: "https://github.com/actions/runner/github-hosted",
        },
      },
    },
    predicateType: "https://slsa.dev/provenance/v1",
    subject: [
      {
        digest: { sha512: EXPECTATION.packageSha512 },
        name: "pkg:npm/%40nakafa/cli@0.1.0",
      },
    ],
  });
}

function audit(
  options: {
    readonly bundles?: number;
    readonly invalid?: readonly unknown[];
    readonly name?: string;
  } = {}
) {
  return JSON.stringify({
    invalid: options.invalid ?? [],
    missing: [],
    verified: [
      {
        attestationBundles: Array.from(
          { length: options.bundles ?? 1 },
          () => ({
            bundle: BUNDLE,
            predicateType: "https://slsa.dev/provenance/v1",
          })
        ),
        attestations: {
          provenance: { predicateType: "https://slsa.dev/provenance/v1" },
          url: "https://registry.npmjs.org/-/npm/v1/attestations/@nakafa%2fcli@0.1.0",
        },
        name: options.name ?? EXPECTATION.packageName,
        version: EXPECTATION.packageVersion,
      },
    ],
  });
}

function verifier(
  payload: string,
  observe?: (bundle: unknown, identity: unknown) => void
) {
  return Layer.succeed(ProvenanceBundleVerifier, {
    verify: (bundle, identity) =>
      Effect.sync(() => {
        observe?.(bundle, identity);
        return payload;
      }),
  });
}

describe("npm provenance", () => {
  it.effect("accepts one certificate-verified exact publication", () =>
    Effect.gen(function* () {
      let observedBundle: unknown;
      let observedIdentity: unknown;
      yield* verifyProvenance(audit(), EXPECTATION).pipe(
        Effect.provide(
          verifier(statement(), (bundle, identity) => {
            observedBundle = bundle;
            observedIdentity = identity;
          })
        )
      );

      assert.deepStrictEqual(observedBundle, BUNDLE);
      assert.deepStrictEqual(observedIdentity, EXPECTATION);
    })
  );

  it.effect("rejects invalid audits before trusting a bundle", () =>
    Effect.gen(function* () {
      const result = yield* verifyProvenance(
        audit({ invalid: [{ name: EXPECTATION.packageName }] }),
        EXPECTATION
      ).pipe(Effect.provide(verifier(statement())), Effect.result);

      assert(Result.isFailure(result));
      assert.strictEqual(
        result.failure.message,
        "The npm signature audit contains invalid or missing evidence."
      );
    })
  );

  it.effect("rejects ambiguous publications and provenance bundles", () =>
    Effect.gen(function* () {
      const missingPublication = yield* verifyProvenance(
        audit({ name: "@nakafa/other" }),
        EXPECTATION
      ).pipe(Effect.provide(verifier(statement())), Effect.result);
      const duplicateBundle = yield* verifyProvenance(
        audit({ bundles: 2 }),
        EXPECTATION
      ).pipe(Effect.provide(verifier(statement())), Effect.result);

      assert(Result.isFailure(missingPublication));
      assert.strictEqual(
        missingPublication.failure.message,
        "The npm audit does not contain one exact package publication."
      );
      assert(Result.isFailure(duplicateBundle));
      assert.strictEqual(
        duplicateBundle.failure.message,
        "The npm audit does not contain one exact SLSA bundle."
      );
    })
  );

  it.effect(
    "rejects self-asserted payload identity after bundle verification",
    () =>
      Effect.gen(function* () {
        const result = yield* verifyProvenance(audit(), EXPECTATION).pipe(
          Effect.provide(
            verifier(statement("fedcba9876543210fedcba9876543210fedcba98"))
          ),
          Effect.result
        );

        assert(Result.isFailure(result));
        assert.strictEqual(
          result.failure.message,
          "The authenticated SLSA statement does not match the exact release."
        );
      })
  );

  it.effect("rejects malformed authenticated statements", () =>
    Effect.gen(function* () {
      const result = yield* verifyProvenance(audit(), EXPECTATION).pipe(
        Effect.provide(verifier("{}")),
        Effect.result
      );

      assert(Result.isFailure(result));
      assert.strictEqual(
        result.failure.message,
        "The authenticated SLSA statement is invalid."
      );
    })
  );
});
