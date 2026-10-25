import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { EMPTY_RESULT_CATALOG_DIGEST } from "@nakafa/aksara-contracts/release/result/spec";
import type { ContentSnapshotSet } from "@nakafa/aksara-contracts/release/snapshot/spec";
import {
  inheritContentSnapshots,
  invertContentSnapshots,
  snapshotRowCount,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import { RendererManifestEnvelopeSchema } from "@nakafa/aksara-contracts/renderer/contract";
import {
  CURRENT_CONTENT_GENERATION,
  RETIRED_CONTENT_GENERATION,
} from "@repo/backend/confect/contentRelease/generation";
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

/** The retired release that a bootstrap replaces, active under the 0.51 generation. */
const RETIRED_BASE = {
  manifestHash: `sha256:${"b".repeat(64)}`,
  releaseId: "release-retired-base",
  sequence: 1,
} satisfies TestIdentity;

/** The first 1.0.0 release, declared over the retired base. */
export const BOOTSTRAP = {
  manifestHash: `sha256:${"c".repeat(64)}`,
  releaseId: "release-bootstrap",
  sequence: 2,
} satisfies TestIdentity;

/** A retained inverse that a bootstrap must never carry. */
export const BOOTSTRAP_RECOVERY = {
  manifestHash: `sha256:${"d".repeat(64)}`,
  releaseId: "release-bootstrap-recovery",
  sequence: 3,
} satisfies TestIdentity;

/**
 * Seeds one verified candidate over the retired base, with its declaration,
 * generation, snapshots and optional inverse chosen by the test. A null
 * generation leaves the active release's generation unrecorded.
 */
export async function seedRetiredCandidate(
  ctx: Parameters<typeof insertTestState>[0],
  options: {
    readonly bootstrap: boolean;
    readonly generation?:
      | typeof CURRENT_CONTENT_GENERATION
      | typeof RETIRED_CONTENT_GENERATION
      | null;
    readonly recovery?: boolean;
    readonly snapshots?: ContentSnapshotSet;
  }
) {
  await insertZeroRelease(ctx, {
    ...RETIRED_BASE,
    ownership: { base: [], result: ContentFamilySchema.literals },
    role: "candidate",
    status: "completed",
  });
  await insertZeroRelease(ctx, {
    ...BOOTSTRAP,
    base: RETIRED_BASE,
    bootstrap: options.bootstrap,
    ownership: {
      base: ContentFamilySchema.literals,
      result: ContentFamilySchema.literals,
    },
    role: "candidate",
    snapshots: options.snapshots,
    status: "verified",
  });
  if (options.recovery) {
    await insertZeroRelease(ctx, {
      ...BOOTSTRAP_RECOVERY,
      base: BOOTSTRAP,
      originReleaseId: BOOTSTRAP.releaseId,
      ownership: { base: ContentFamilySchema.literals, result: [] },
      role: "recovery",
      snapshots: options.snapshots && invertContentSnapshots(options.snapshots),
      status: "verified",
    });
  }
  await insertTestState(ctx, {
    active: RETIRED_BASE,
    candidate: BOOTSTRAP,
    generation:
      options.generation === undefined
        ? RETIRED_CONTENT_GENERATION
        : options.generation,
    nextSequence: 4,
    recovery: options.recovery ? BOOTSTRAP_RECOVERY : undefined,
  });
}

/** Seeds one completed bootstrap as the active release, with a recovery row that has no slot. */
export async function seedActiveBootstrap(
  ctx: Parameters<typeof insertTestState>[0]
) {
  await insertZeroRelease(ctx, {
    ...BOOTSTRAP,
    base: RETIRED_BASE,
    bootstrap: true,
    ownership: {
      base: ContentFamilySchema.literals,
      result: ContentFamilySchema.literals,
    },
    role: "candidate",
    status: "completed",
  });
  await insertZeroRelease(ctx, {
    ...BOOTSTRAP_RECOVERY,
    base: BOOTSTRAP,
    originReleaseId: BOOTSTRAP.releaseId,
    ownership: { base: ContentFamilySchema.literals, result: [] },
    role: "recovery",
    status: "verified",
  });
  await insertTestState(ctx, {
    active: BOOTSTRAP,
    generation: CURRENT_CONTENT_GENERATION,
    nextSequence: 4,
  });
}

const ACTIVATION_RENDERER = Schema.decodeSync(
  Schema.fromJsonString(RendererManifestEnvelopeSchema)
)(testRendererJson());

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
    activeAppLocales: [...ACTIVE_APP_LOCALE_CODES],
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
