import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { EMPTY_RESULT_CATALOG_DIGEST } from "@nakafa/aksara-contracts/release/result/spec";
import type { ContentSnapshotSet } from "@nakafa/aksara-contracts/release/snapshot/spec";
import {
  inheritContentSnapshots,
  snapshotRowCount,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import { RendererManifestEnvelopeSchema } from "@nakafa/aksara-contracts/renderer/contract";
import {
  TEST_DIGEST,
  testRendererJson,
} from "@repo/backend/test/content/release";
import {
  insertTestState,
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content/state";
import { makeRuntimeIngressFixture } from "@repo/backend/test/runtime/ingress";
import { Effect, Schema } from "effect";

export const CANDIDATE = {
  manifestHash: `sha256:${"6".repeat(64)}`,
  releaseId: "release-candidate",
  sequence: 1,
} satisfies TestIdentity;

export const BASE = {
  manifestHash: `sha256:${"5".repeat(64)}`,
  releaseId: "release-base",
  sequence: 0,
} satisfies TestIdentity;

export const RECOVERY = {
  manifestHash: `sha256:${"7".repeat(64)}`,
  releaseId: "release-recovery",
  sequence: 2,
} satisfies TestIdentity;

const ACTIVATION_RENDERER = Schema.decodeUnknownSync(
  RendererManifestEnvelopeSchema
)(JSON.parse(testRendererJson()));

/** Seeds one verified genesis candidate and its exact verified inverse. */
export async function seedVerifiedPair(
  ctx: Parameters<typeof insertTestState>[0],
  snapshots?: {
    readonly base?: TestIdentity;
    readonly candidate: ContentSnapshotSet;
    readonly recovery: ContentSnapshotSet;
  }
) {
  await insertZeroRelease(ctx, {
    ...CANDIDATE,
    base: snapshots?.base,
    ownership: {
      base: snapshots?.base ? ContentFamilySchema.literals : [],
      result: ContentFamilySchema.literals,
    },
    role: "candidate",
    snapshots: snapshots?.candidate,
    status: "verified",
  });
  await insertZeroRelease(ctx, {
    ...RECOVERY,
    base: CANDIDATE,
    originReleaseId: CANDIDATE.releaseId,
    ownership: {
      base: ContentFamilySchema.literals,
      result: [],
    },
    role: "recovery",
    snapshots: snapshots?.recovery,
    status: "verified",
  });
  await insertTestState(ctx, {
    active: snapshots?.base,
    candidate: CANDIDATE,
    nextSequence: 3,
    recovery: RECOVERY,
  });
}

/** Builds the exact terminal receipt expected for one technical identity. */
export function expectedReceipt(
  identity: TestIdentity,
  snapshots = inheritContentSnapshots(null)
) {
  return {
    activatedHeads: 0,
    activeAppLocales: ACTIVE_APP_LOCALE_CODES,
    deletedHeads: 0,
    manifestHash: identity.manifestHash,
    projectionDigest: TEST_DIGEST,
    releaseId: identity.releaseId,
    resultCount: 0,
    resultDigest: EMPTY_RESULT_CATALOG_DIGEST,
    routeDigest: TEST_DIGEST,
    snapshots,
    stagedArtifacts: 0,
    stagedItems: 0,
    stagedProjections: 0,
    stagedRoutes: 0,
    stagedSnapshotRows: snapshotRowCount(snapshots),
  };
}

/** Creates a permanent runtime fixture using the activation renderer identity. */
export const makeActivationRuntime = Effect.fn("test.activation.makeRuntime")(
  function* (options?: {
    readonly bundleSnapshot?: "base" | "result";
    readonly hasBaseSnapshot?: boolean;
  }) {
    return yield* makeRuntimeIngressFixture(
      ReleaseIdSchema.make("release-runtime-activation"),
      ACTIVATION_RENDERER,
      options
    );
  }
);
