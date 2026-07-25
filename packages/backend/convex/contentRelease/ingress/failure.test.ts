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
import { testArtifactJson } from "@repo/backend/test/content-artifact";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testProjectionJson,
  testReleaseJson,
  testRendererJson,
  testRouteJson,
  testUpsertJson,
} from "@repo/backend/test/content-release";
import { Cause, Effect, Exit, Option, Schema } from "effect";
import { describe, expect, it } from "vitest";

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

/** Runs one request-failure conversion at the Vitest boundary. */
function failure(request: PublicationRequest, code: ReleaseError["code"]) {
  return Effect.runPromiseExit(
    requestFailure(
      request,
      new ReleaseError({ code, message: "Technical failure." }),
      null
    )
  );
}

describe("content publication failure mapping", () => {
  it("derives every exact request identity without a duplicate map", () => {
    expect(requestReleaseId(requests.current)).toBeNull();
    expect(requestReleaseId(requests.recovery)).toBe(recoveryId);
    expect(requestReleaseId(requests.stageRecovery)).toBe(recoveryId);
    expect(requestReleaseId(requests.activateRecovery)).toBe(recoveryId);
    for (const publicationRequest of Object.values(requests)) {
      if (
        publicationRequest.operation !== "current" &&
        publicationRequest.operation !== "recovery" &&
        publicationRequest.operation !== "stageRecovery" &&
        publicationRequest.operation !== "activateRecovery"
      ) {
        expect(requestReleaseId(publicationRequest)).toBe(TEST_RELEASE_ID);
      }
    }
  });

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

  it("preserves every operation identity for domain rejection", async () => {
    for (const publicationRequest of Object.values(requests)) {
      const exit = await failure(publicationRequest, "CONTENT_RELEASE_STATE");
      expect(exit).toMatchObject({
        _tag: "Success",
        value: {
          code: "CONTENT_RELEASE_STATE",
          operation: publicationRequest.operation,
        },
      });
    }
  });

  it("preserves only contract-supported immutable conflicts", async () => {
    for (const operation of [
      "stageItemBatch",
      "stageRouteBatch",
      "stageProjectionBatch",
      "stageArtifactBatch",
    ] as const) {
      const exit = await failure(
        requests[operation],
        "CONTENT_RELEASE_CONFLICT"
      );
      expect(exit).toMatchObject({
        _tag: "Success",
        value: { batchIndex: 0, kind: "conflict", operation },
      });
    }
    for (const operation of [
      "accept",
      "abort",
      "stageRelease",
      "stageRecovery",
      "status",
      "verify",
      "activate",
      "activateRecovery",
      "rollbackPage",
      "routePage",
      "cleanup",
    ] as const) {
      const exit = await failure(
        requests[operation],
        "CONTENT_RELEASE_CONFLICT"
      );
      expect(exit).toMatchObject({
        _tag: "Success",
        value: { kind: "conflict", operation },
      });
    }
  });

  it("builds stale-base evidence only for its two legal operations", async () => {
    for (const operation of ["stageRelease", "activate"] as const) {
      const exit = await failure(
        requests[operation],
        "CONTENT_RELEASE_STALE_BASE"
      );
      expect(exit).toMatchObject({
        _tag: "Success",
        value: { kind: "stale-base", operation },
      });
    }
  });

  it("defects on impossible request and error pairings", async () => {
    for (const [operation, code] of [
      ["current", "CONTENT_RELEASE_CONFLICT"],
      ["headPage", "CONTENT_RELEASE_CONFLICT"],
      ["recovery", "CONTENT_RELEASE_CONFLICT"],
      ["rollbackPage", "CONTENT_RELEASE_STALE_BASE"],
      ["current", "CONTENT_RELEASE_INVALID_REQUEST"],
      ["current", "CONTENT_RELEASE_UNAUTHORIZED"],
    ] as const) {
      const exit = await failure(requests[operation], code);
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(Option.getOrUndefined(Cause.dieOption(exit.cause))).toEqual(
          new PublicationFailureDefect({ code, operation })
        );
      }
    }
  });
});
