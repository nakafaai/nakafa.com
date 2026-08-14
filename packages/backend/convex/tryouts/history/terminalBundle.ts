"use node";

import { verifySignedContentArtifact } from "@nakafa/aksara-contracts/artifact/verify";
import { verifySignedContentRelease } from "@nakafa/aksara-contracts/release/verify";
import type {
  RendererContractVersion,
  RendererManifestEnvelope,
} from "@nakafa/aksara-contracts/renderer/contract";
import { validateRendererManifestHash } from "@nakafa/aksara-contracts/renderer/manifest";
import {
  decodeArtifactJson,
  decodeReleaseJson,
  decodeRendererJson,
} from "@repo/backend/convex/contentRelease/parse";
import { hasRendererIdentity } from "@repo/backend/convex/contentRelease/renderer";
import { decodeHistoryRowJson } from "@repo/backend/convex/tryouts/history/decode";
import {
  historyFail,
  historyIntegrity,
  type RetainedTryoutHistoryPlan,
} from "@repo/backend/convex/tryouts/history/spec";
import type { TerminalPlacementRow } from "@repo/backend/convex/tryouts/history/terminalPage";
import type { TerminalSignedState } from "@repo/backend/convex/tryouts/history/terminalState";
import { Effect } from "effect";

type StoredBundle = TerminalSignedState["bundles"][number];

export interface AuthenticatedTerminalBundle {
  readonly releaseId: string;
  readonly renderer: RendererManifestEnvelope;
  readonly rendererContractVersion: RendererContractVersion;
}

/** Signature-verifies both exact retained releases and their renderers. */
export const authenticateTerminalBundles = Effect.fn(
  "tryouts.history.authenticateTerminalBundles"
)(function* (
  bundles: readonly StoredBundle[],
  plan: RetainedTryoutHistoryPlan
) {
  if (bundles.length !== plan.releases.length) {
    return yield* historyFail(
      "TRYOUT_HISTORY_NOT_READY",
      `Found ${bundles.length} retained bundles, expected ${plan.releases.length}.`
    );
  }
  const storedByRelease = new Map<string, StoredBundle>();
  for (const bundle of bundles) {
    if (storedByRelease.has(bundle.releaseId)) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `Retained release ${bundle.releaseId} has duplicate bundles.`
      );
    }
    storedByRelease.set(bundle.releaseId, bundle);
  }

  const authenticated = yield* Effect.forEach(plan.releases, (expected) =>
    authenticateTerminalBundle(storedByRelease.get(expected.releaseId), {
      manifestHash: expected.manifestHash,
      releaseId: expected.releaseId,
      snapshotId: plan.snapshotId,
    })
  );
  const first = authenticated[0];
  if (
    !first ||
    authenticated.some(
      (bundle) =>
        bundle.renderer.hash !== first.renderer.hash ||
        bundle.rendererContractVersion !== first.rendererContractVersion
    )
  ) {
    return yield* historyFail(
      "TRYOUT_HISTORY_INTEGRITY",
      "Retained releases do not share one authenticated renderer contract."
    );
  }
  return authenticated;
});

const authenticateTerminalBundle = Effect.fn(
  "tryouts.history.authenticateTerminalBundle"
)(function* (
  bundle: StoredBundle | undefined,
  expected: {
    readonly manifestHash: string;
    readonly releaseId: string;
    readonly snapshotId: string;
  }
) {
  if (!bundle) {
    return yield* historyFail(
      "TRYOUT_HISTORY_NOT_READY",
      `Retained release ${expected.releaseId} has no bundle.`
    );
  }
  const [storedRelease, renderer] = yield* Effect.all([
    decodeReleaseJson(bundle.releaseJson).pipe(
      Effect.mapError(() =>
        historyIntegrity(`Retained release ${expected.releaseId} is invalid.`)
      )
    ),
    decodeRendererJson(bundle.rendererJson).pipe(
      Effect.flatMap(validateRendererManifestHash),
      Effect.mapError(() =>
        historyIntegrity(`Retained renderer ${expected.releaseId} is invalid.`)
      )
    ),
  ]);
  const release = yield* verifySignedContentRelease(storedRelease).pipe(
    Effect.mapError(() =>
      historyIntegrity(
        `Retained release ${expected.releaseId} failed signature verification.`
      )
    )
  );
  if (
    bundle.manifestHash !== expected.manifestHash ||
    bundle.releaseId !== expected.releaseId ||
    bundle.snapshotId !== expected.snapshotId ||
    release.manifestHash !== expected.manifestHash ||
    release.manifest.releaseId !== expected.releaseId ||
    release.manifest.snapshots.tryout.resultSnapshotId !==
      expected.snapshotId ||
    !hasRendererIdentity(release.manifest, renderer)
  ) {
    return yield* historyFail(
      "TRYOUT_HISTORY_INTEGRITY",
      `Retained bundle ${expected.releaseId} lost its signed snapshot binding.`
    );
  }
  return {
    releaseId: expected.releaseId,
    renderer,
    rendererContractVersion: release.manifest.rendererContractVersion,
  } satisfies AuthenticatedTerminalBundle;
});

/** Authenticates and releases one bounded page of placement artifact bytes. */
export const authenticateTerminalArtifactPage = Effect.fn(
  "tryouts.history.authenticateTerminalArtifactPage"
)(function* (
  storedRows: readonly TerminalPlacementRow[],
  bundles: readonly AuthenticatedTerminalBundle[]
) {
  const bundle = bundles[0];
  if (!bundle) {
    return yield* historyFail(
      "TRYOUT_HISTORY_NOT_READY",
      "No authenticated retained renderer is available for artifacts."
    );
  }
  const hashes = new Set<string>();
  for (const stored of storedRows) {
    const signed = yield* decodeHistoryRowJson(stored.rowJson, stored.rowHash);
    if (signed.rowKind !== "placement") {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `History placement ${stored.rowHash} changed its row kind.`
      );
    }
    const row = signed.record.row;
    if (
      stored.rowHash !== signed.record.rowHash ||
      stored.answerArtifactHash !== row.answerArtifactHash ||
      stored.questionArtifactHash !== row.questionArtifactHash
    ) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `History placement ${stored.rowHash} lost its stored artifact binding.`
      );
    }
    const [answerHash, questionHash] = yield* Effect.all([
      authenticateArtifact(
        stored.answerArtifactJson,
        row.answerArtifactHash,
        row.answerContentKey,
        row.rendererDomain,
        bundle
      ),
      authenticateArtifact(
        stored.questionArtifactJson,
        row.questionArtifactHash,
        row.questionContentKey,
        row.rendererDomain,
        bundle
      ),
    ]);
    hashes.add(answerHash);
    hashes.add(questionHash);
  }
  return hashes;
});

const authenticateArtifact = Effect.fn(
  "tryouts.history.authenticateTerminalArtifact"
)(function* (
  artifactJson: string,
  artifactHash: string,
  contentKey: string,
  rendererDomain: string,
  bundle: AuthenticatedTerminalBundle
) {
  const artifact = yield* decodeArtifactJson(artifactJson).pipe(
    Effect.mapError(() =>
      historyIntegrity(`Artifact ${artifactHash} is invalid.`)
    )
  );
  const verified = yield* verifySignedContentArtifact({
    artifact,
    rendererContractVersion: bundle.rendererContractVersion,
    rendererManifest: bundle.renderer,
  }).pipe(
    Effect.mapError(() =>
      historyIntegrity(
        `Artifact ${artifactHash} failed signature verification.`
      )
    )
  );
  if (
    verified.artifactHash !== artifactHash ||
    verified.payload.contentKey !== contentKey ||
    verified.payload.rendererDomain !== rendererDomain
  ) {
    return yield* historyFail(
      "TRYOUT_HISTORY_INTEGRITY",
      `Artifact ${artifactHash} lost its retained placement binding.`
    );
  }
  return verified.artifactHash;
});
