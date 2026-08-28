import { describe, expect, it } from "@effect/vitest";
import {
  type PublicationRequest,
  PublicationRequestSchema,
} from "@nakafa/aksara-contracts/transport/request";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import {
  PublicationFailureDefect,
  predecodeFailure,
  requestFailure,
  requestReleaseId,
} from "@repo/backend/convex/contentRelease/ingress/failure";
import { testArtifactJson } from "@repo/backend/test/content/artifact";
import { testProjectionJson } from "@repo/backend/test/content/material";
import {
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedRelease,
  testSignedTryoutRuntimeBundle,
} from "@repo/backend/test/content/proof";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testReleaseJson,
  testRendererJson,
  testRouteJson,
  testUpsertJson,
} from "@repo/backend/test/content/release";
import { makeTryoutSnapshotManifest } from "@repo/backend/test/tryout/snapshot";
import { Cause, Effect, Exit, Result, Schema } from "effect";

/** Strictly decodes one technical request through the shared contract. */
function request(input: unknown) {
  return Schema.decodeUnknownSync(PublicationRequestSchema)(input);
}

const recoveryId = "release-recovery";
const release: unknown = JSON.parse(testReleaseJson());
const recoveryRelease: unknown = JSON.parse(
  testReleaseJson({
    baseReleaseId: TEST_RELEASE_ID,
    originReleaseId: TEST_RELEASE_ID,
    releaseId: recoveryId,
  })
);
const rendererManifest: unknown = JSON.parse(testRendererJson());
const requests = {
  accept: request({
    operation: "accept",
    recoveryId,
    releaseId: TEST_RELEASE_ID,
  }),
  abort: request({ operation: "abort", releaseId: TEST_RELEASE_ID }),
  activate: request({ operation: "activate", release }),
  activateRecovery: request({
    operation: "activateRecovery",
    release: recoveryRelease,
  }),
  cleanup: request({ operation: "cleanup", releaseId: TEST_RELEASE_ID }),
  current: request({ operation: "current" }),
  headPage: request({
    activeManifestHash: TEST_MANIFEST_HASH,
    activeReleaseId: TEST_RELEASE_ID,
    cursor: null,
    family: "material",
    limit: 1,
    operation: "headPage",
  }),
  recovery: request({
    operation: "recovery",
    recoveryId,
    releaseId: TEST_RELEASE_ID,
  }),
  rollbackPage: request({
    afterIndex: -1,
    limit: 1,
    operation: "rollbackPage",
    rollbackOf: TEST_RELEASE_ID,
    rollbackOfManifestHash: TEST_MANIFEST_HASH,
  }),
  routePage: request({
    afterIndex: -1,
    limit: 1,
    operation: "routePage",
    rollbackOf: TEST_RELEASE_ID,
    rollbackOfManifestHash: TEST_MANIFEST_HASH,
  }),
  stageArtifactBatch: request({
    artifacts: [JSON.parse(testArtifactJson())],
    batchIndex: 0,
    operation: "stageArtifactBatch",
    releaseId: TEST_RELEASE_ID,
  }),
  stageGroup: request({
    operation: "stageGroup",
    releaseId: TEST_RELEASE_ID,
    requests: [
      {
        batchIndex: 0,
        items: [JSON.parse(testUpsertJson())],
        operation: "stageItemBatch",
        releaseId: TEST_RELEASE_ID,
      },
    ],
  }),
  stageItemBatch: request({
    batchIndex: 0,
    items: [JSON.parse(testUpsertJson())],
    operation: "stageItemBatch",
    releaseId: TEST_RELEASE_ID,
  }),
  stageProjectionBatch: request({
    batchIndex: 0,
    operation: "stageProjectionBatch",
    projections: [JSON.parse(testProjectionJson())],
    releaseId: TEST_RELEASE_ID,
  }),
  stageRecovery: request({
    operation: "stageRecovery",
    release: recoveryRelease,
    rendererManifest,
  }),
  stageRelease: request({
    operation: "stageRelease",
    release,
    rendererManifest,
  }),
  stageRouteBatch: request({
    batchIndex: 0,
    operation: "stageRouteBatch",
    releaseId: TEST_RELEASE_ID,
    routes: [JSON.parse(testRouteJson())],
  }),
  status: request({
    manifestHash: TEST_MANIFEST_HASH,
    operation: "status",
    releaseId: TEST_RELEASE_ID,
  }),
  verify: request({ operation: "verify", release }),
};

/** Creates one schema-valid permanent-bundle request for mapping tests. */
const makeRuntimeBundleRequest = Effect.fn(
  "contentReleaseTest.makeRuntimeBundleRequest"
)(function* () {
  const snapshot = (yield* makeTryoutSnapshotManifest()).manifest;
  const signedRelease = testSignedRelease(testEmptyManifest(TEST_RELEASE_ID));
  const decoded = request({
    bundle: testSignedTryoutRuntimeBundle({
      release: signedRelease,
      rendererManifest: TEST_PROOF_RENDERER,
      snapshot,
    }),
    operation: "stageTryoutRuntimeBundle",
    releaseId: TEST_RELEASE_ID,
  });
  if (decoded.operation !== "stageTryoutRuntimeBundle") {
    return yield* Effect.die("Expected one runtime-bundle request.");
  }
  return decoded;
});

/** Runs one request-failure conversion at the Vitest boundary. */
function failure(request: PublicationRequest, code: ReleaseError["code"]) {
  return Effect.exit(
    requestFailure(
      request,
      new ReleaseError({ code, message: "Technical failure." }),
      null
    )
  );
}

describe("content publication failure mapping", () => {
  it.live("derives every exact request identity without a duplicate map", () =>
    Effect.gen(function* () {
      const runtimeBundleRequest = yield* makeRuntimeBundleRequest();
      expect(requestReleaseId(requests.current)).toBeNull();
      expect(requestReleaseId(requests.recovery)).toBe(recoveryId);
      expect(requestReleaseId(requests.stageRecovery)).toBe(recoveryId);
      expect(requestReleaseId(requests.activateRecovery)).toBe(recoveryId);
      for (const publicationRequest of [
        ...Object.values(requests),
        runtimeBundleRequest,
      ]) {
        if (
          publicationRequest.operation !== "current" &&
          publicationRequest.operation !== "recovery" &&
          publicationRequest.operation !== "stageRecovery" &&
          publicationRequest.operation !== "activateRecovery"
        ) {
          expect(requestReleaseId(publicationRequest)).toBe(TEST_RELEASE_ID);
        }
      }
    })
  );

  it("sanitizes predecode failures without retaining private detail", () => {
    /** Builds one private failure whose message must never cross ingress. */
    const make = (code: ReleaseError["code"]) =>
      new ReleaseError({ code, message: "Private technical detail." });

    expect(predecodeFailure(make("CONTENT_RELEASE_UNAUTHORIZED"))).toEqual({
      code: "CONTENT_RELEASE_UNAUTHORIZED",
      kind: "unauthorized",
    });
    for (const code of [
      "CONTENT_RELEASE_SIZE",
      "CONTENT_RELEASE_UNSUPPORTED",
    ] as const) {
      expect(predecodeFailure(make(code))).toMatchObject({
        code,
        operation: null,
      });
    }
    expect(predecodeFailure(make("CONTENT_RELEASE_CONFLICT"))).toMatchObject({
      code: "CONTENT_RELEASE_INVALID_REQUEST",
      operation: null,
    });
  });

  it.live("preserves every operation identity for domain rejection", () =>
    Effect.gen(function* () {
      const runtimeBundleRequest = yield* makeRuntimeBundleRequest();
      for (const publicationRequest of [
        ...Object.values(requests),
        runtimeBundleRequest,
      ]) {
        const exit = yield* failure(
          publicationRequest,
          "CONTENT_RELEASE_STATE"
        );
        expect(exit).toMatchObject({
          _tag: "Success",
          value: {
            code: "CONTENT_RELEASE_STATE",
            operation: publicationRequest.operation,
          },
        });
      }
    })
  );

  it.live("preserves only contract-supported immutable conflicts", () =>
    Effect.gen(function* () {
      for (const operation of [
        "stageItemBatch",
        "stageRouteBatch",
        "stageProjectionBatch",
        "stageArtifactBatch",
      ] as const) {
        const exit = yield* failure(
          requests[operation],
          "CONTENT_RELEASE_CONFLICT"
        );
        expect(exit).toMatchObject({
          _tag: "Success",
          value: { batchIndex: 0, kind: "conflict", operation },
        });
      }
      const runtimeBundleRequest = yield* makeRuntimeBundleRequest();
      const runtimeBundleExit = yield* failure(
        runtimeBundleRequest,
        "CONTENT_RELEASE_CONFLICT"
      );
      expect(runtimeBundleExit).toMatchObject({
        _tag: "Success",
        value: {
          bundleHash: runtimeBundleRequest.bundle.bundleHash,
          kind: "conflict",
          operation: "stageTryoutRuntimeBundle",
          snapshotId: runtimeBundleRequest.bundle.payload.snapshot.snapshotId,
        },
      });
      for (const operation of [
        "accept",
        "abort",
        "stageRelease",
        "stageRecovery",
        "stageGroup",
        "status",
        "verify",
        "activate",
        "activateRecovery",
        "rollbackPage",
        "routePage",
        "cleanup",
      ] as const) {
        const exit = yield* failure(
          requests[operation],
          "CONTENT_RELEASE_CONFLICT"
        );
        expect(exit).toMatchObject({
          _tag: "Success",
          value: { kind: "conflict", operation },
        });
      }
    })
  );

  it.live("builds stale-base evidence only for its two legal operations", () =>
    Effect.gen(function* () {
      for (const operation of ["stageRelease", "activate"] as const) {
        const exit = yield* failure(
          requests[operation],
          "CONTENT_RELEASE_STALE_BASE"
        );
        expect(exit).toMatchObject({
          _tag: "Success",
          value: { kind: "stale-base", operation },
        });
      }
    })
  );

  it.live("defects on impossible request and error pairings", () =>
    Effect.gen(function* () {
      for (const [operation, code] of [
        ["current", "CONTENT_RELEASE_CONFLICT"],
        ["headPage", "CONTENT_RELEASE_CONFLICT"],
        ["recovery", "CONTENT_RELEASE_CONFLICT"],
        ["rollbackPage", "CONTENT_RELEASE_STALE_BASE"],
        ["current", "CONTENT_RELEASE_INVALID_REQUEST"],
        ["current", "CONTENT_RELEASE_UNAUTHORIZED"],
      ] as const) {
        const exit = yield* failure(requests[operation], code);
        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          expect(Cause.findDefect(exit.cause)).toEqual(
            Result.succeed(new PublicationFailureDefect({ code, operation }))
          );
        }
      }
    })
  );
});
