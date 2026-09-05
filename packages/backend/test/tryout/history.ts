import { createHash } from "node:crypto";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { canonicalQuestionResponse } from "@nakafa/aksara-contracts/question/response";
import { replaceContentSnapshot } from "@nakafa/aksara-contracts/release/snapshot/spec";
import {
  tryoutCatalogNodeIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import { makeTryoutSnapshot } from "@nakafa/aksara-contracts/tryout/snapshot/hash";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  decodeReleaseJson,
  decodeSnapshotRowJson,
  decodeTryoutRuntimeBundleJson,
} from "@repo/backend/convex/contentRelease/parse";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import type { TryoutHistoryRequest } from "@repo/backend/convex/tryouts/runtime/history/spec";
import {
  TEST_PROOF_RENDERER,
  testSignedRelease,
  testSignedTryoutRuntimeBundle,
} from "@repo/backend/test/content/proof";
import { insertProtectedRuntime } from "@repo/backend/test/runtime/protected";
import { TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";
import { Effect } from "effect";

/** Rebuilds a technical fixture using the exact choices-era placement hash format. */
async function retainChoicesSnapshot(
  ctx: MutationCtx,
  runtime: Doc<"tryoutRuntimeBundles">
) {
  const decoded = await Effect.runPromise(
    decodeTryoutRuntimeBundleJson(runtime.bundleJson)
  );
  const placements = await ctx.db
    .query("tryoutPlacements")
    .withIndex("by_snapshotId_and_index", (index) =>
      index.eq("snapshotId", runtime.snapshotId)
    )
    .take(3);
  const records: {
    stored: Doc<"tryoutPlacements">;
    rowJson: string;
    rowHash: typeof Sha256HashSchema.Type;
  }[] = [];
  const digest = createHash("sha256").update(
    "nakafa.aksara.tryout-placements\n"
  );
  for (const stored of placements) {
    const original = await Effect.runPromise(
      decodeSnapshotRowJson(stored.rowJson)
    );
    if (
      original.family !== "tryout" ||
      original.rowKind !== "placement" ||
      original.record.row.response.kind !== "single-choice"
    ) {
      throw new Error("Expected one technical single-choice placement.");
    }
    const { response, languagePolicy, ...identity } = original.record.row;
    const row = { ...identity, choices: response.options };
    const canonical = JSON.stringify(
      Object.fromEntries(
        Object.entries(row).sort(([left], [right]) => {
          if (left < right) {
            return -1;
          }
          return left > right ? 1 : 0;
        })
      )
    );
    const rowHash = Sha256HashSchema.make(
      `sha256:${createHash("sha256").update("nakafa.aksara.tryout-placements\n").update(canonical).digest("hex")}`
    );
    digest.update(`${canonical}\0${rowHash}\n`);
    records.push({
      stored,
      rowJson: JSON.stringify({
        family: "tryout",
        rowKind: "placement",
        record: { row, rowHash },
      }),
      rowHash,
    });
  }
  const snapshot = makeTryoutSnapshot({
    ...decoded.payload.snapshot,
    placementDigest: Sha256HashSchema.make(`sha256:${digest.digest("hex")}`),
  });
  const release = await ctx.db.query("contentReleases").unique();
  const storedSnapshot = await ctx.db
    .query("contentSnapshots")
    .withIndex("by_family_and_snapshotId", (index) =>
      index.eq("family", "tryout").eq("snapshotId", runtime.snapshotId)
    )
    .unique();
  if (!(release && storedSnapshot)) {
    throw new Error("Expected one technical signed publication.");
  }
  const signedRelease = await Effect.runPromise(
    decodeReleaseJson(release.releaseJson)
  );
  const bundle = testSignedTryoutRuntimeBundle({
    release: testSignedRelease({
      ...signedRelease.manifest,
      snapshots: {
        ...signedRelease.manifest.snapshots,
        tryout: replaceContentSnapshot({
          baseSnapshotId: null,
          resultSnapshotId: snapshot.snapshotId,
          rowCount:
            Object.values(snapshot.counts).reduce(
              (sum, count) => sum + count,
              0
            ) + snapshot.placementCount,
          rowDigest: snapshot.snapshotId,
        }),
      },
    }),
    rendererManifest: TEST_PROOF_RENDERER,
    snapshot,
  });
  await ctx.db.patch(storedSnapshot._id, {
    snapshotId: snapshot.snapshotId,
    snapshotJson: JSON.stringify({ family: "tryout", manifest: snapshot }),
  });
  for (const record of records) {
    await ctx.db.patch(record.stored._id, {
      rowHash: record.rowHash,
      rowJson: record.rowJson,
      snapshotId: snapshot.snapshotId,
    });
  }
  await ctx.db.patch(runtime._id, {
    bundleHash: bundle.bundleHash,
    bundleJson: JSON.stringify(bundle),
    snapshotId: snapshot.snapshotId,
    sourceManifestHash: bundle.payload.sourceManifestHash,
  });
  await ctx.db.delete(release._id);
  const state = await ctx.db.query("contentState").unique();
  if (state) {
    await ctx.db.delete(state._id);
  }
}

/** Seeds signed technical bodies, an owned attempt and its exact frozen membership. */
export async function insertHistoryAttempt(
  ctx: MutationCtx,
  historical = false,
  rawMdx?: string
) {
  const fixture = await insertProtectedRuntime(ctx, { rawMdx });
  const initialRuntime = await ctx.db.get(fixture.runtimeId);
  if (!initialRuntime) {
    throw new Error("Expected one signed runtime bundle.");
  }
  if (historical) {
    await retainChoicesSnapshot(ctx, initialRuntime);
  }
  const runtime = await ctx.db.get(fixture.runtimeId);
  const identity = await seedAuthenticatedUser(ctx, {
    now: TRYOUT_TEST_NOW,
    suffix: "history-owner",
  });
  if (!runtime) {
    throw new Error("Expected one retained runtime bundle.");
  }
  const placement = fixture.placement;
  const retained = await ctx.db
    .query("tryoutPlacements")
    .withIndex("by_snapshotId_and_identity", (index) =>
      index
        .eq("snapshotId", runtime.snapshotId)
        .eq("identity", tryoutPlacementIdentity(placement))
    )
    .unique();
  if (!retained) {
    throw new Error("Expected one retained signed placement.");
  }
  const sectionIdentity = tryoutCatalogNodeIdentity({
    ...placement,
    kind: "section",
  });
  const sectionSnapshot = {
    questionCount: 1,
    questionSourcePath: placement.questionSourcePath.slice(
      0,
      placement.questionSourcePath.lastIndexOf("/")
    ),
    sectionIdentity,
    sectionKey: placement.sectionKey,
    sectionOrder: 1,
    sectionRowHash: "technical-section-row",
    sourceRevision: placement.sourceRevision,
    timeLimitSeconds: 120,
  };
  const attemptId = await ctx.db.insert("tryoutAttempts", {
    accessEndsAt: TRYOUT_TEST_NOW + 120_000,
    accessSourceKind: "free",
    appLocale: "en",
    attemptNumber: 1,
    completedAt: TRYOUT_TEST_NOW,
    completedSectionKeys: [placement.sectionKey],
    countsForCompetition: false,
    countryKey: placement.countryKey,
    endReason: "submitted",
    examKey: placement.examKey,
    expiresAt: TRYOUT_TEST_NOW + 120_000,
    lastActivityAt: TRYOUT_TEST_NOW,
    scoreStatus: "provisional",
    scoringStrategy: "irt",
    sectionSnapshots: [sectionSnapshot],
    setIdentity: tryoutCatalogNodeIdentity({ ...placement, kind: "set" }),
    setKey: placement.setKey,
    setPublicPath: "try-out/indonesia/snbt/2027/set-1",
    snapshotReleaseId: runtime.sourceReleaseId,
    startedAt: TRYOUT_TEST_NOW - 120_000,
    status: "completed",
    totalCorrect: 1,
    totalQuestions: 1,
    trackKey: placement.trackKey,
    tryoutBundleHash: runtime.bundleHash,
    tryoutBundleId: runtime._id,
    tryoutSnapshotId: runtime.snapshotId,
    userId: identity.userId,
  });
  const sectionId = await ctx.db.insert("tryoutSectionAttempts", {
    answeredCount: 1,
    completedAt: TRYOUT_TEST_NOW,
    correctAnswers: 1,
    endReason: "submitted",
    expiresAt: TRYOUT_TEST_NOW + 120_000,
    lastActivityAt: TRYOUT_TEST_NOW,
    sectionIdentity,
    sectionKey: placement.sectionKey,
    sectionOrder: 1,
    startedAt: TRYOUT_TEST_NOW - 120_000,
    status: "completed",
    totalQuestions: 1,
    tryoutAttemptId: attemptId,
  });
  const placementId = await ctx.db.insert("tryoutAttemptPlacements", {
    answerArtifactHash: placement.answerArtifactHash,
    answerContentKey: placement.answerContentKey,
    contentHash: placement.contentHash,
    placementIdentity: retained.identity,
    placementRowHash: retained.rowHash,
    questionArtifactHash: placement.questionArtifactHash,
    questionContentKey: placement.questionContentKey,
    questionOrder: placement.questionOrder,
    rendererDomain: placement.rendererDomain,
    responseSpec: canonicalQuestionResponse(placement.response),
    sectionIdentity,
    sectionKey: placement.sectionKey,
    sourcePath: placement.questionSourcePath,
    sourceRevision: placement.sourceRevision,
    tryoutAttemptId: attemptId,
  });
  const selector = {
    appLocale: "en",
    bundleHash: runtime.bundleHash,
    contentHash: placement.contentHash,
    questionOrder: placement.questionOrder,
    sectionKey: placement.sectionKey,
    snapshotId: runtime.snapshotId,
    snapshotReleaseId: runtime.sourceReleaseId,
    sourcePath: placement.questionSourcePath,
    sourceRevision: placement.sourceRevision,
  } as const;
  const request: TryoutHistoryRequest = {
    attemptId,
    selectors: [
      { ...selector, ...fixture.question },
      { ...selector, ...fixture.answer },
    ],
  };
  return {
    fixture,
    identity,
    placementId,
    request,
    retainedId: retained._id,
    runtime,
    sectionId,
  };
}
