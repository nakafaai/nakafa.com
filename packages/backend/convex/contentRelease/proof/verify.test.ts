// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { SignedContentArtifactSchema } from "@nakafa/aksara-contracts/content";
import {
  ContentKeySchema,
  Ed25519SignatureSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { ArtifactLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  ContentReleaseItemSchema,
  ContentReleaseManifestSchema,
} from "@nakafa/aksara-contracts/release";
import { digestItems } from "@nakafa/aksara-contracts/release/digest";
import { digestRollbackSnapshot } from "@nakafa/aksara-contracts/release/rollback/digest";
import {
  canonicalizeRollbackSnapshotEntry,
  RollbackSnapshotEntrySchema,
} from "@nakafa/aksara-contracts/release/rollback/spec";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { recomputeProgram } from "@repo/backend/convex/contentRelease/proof/verify";
import { encodeArtifactJson } from "@repo/backend/convex/contentRelease/wire";
import {
  getUnknownErrorMessage,
  runConvexActionProgram,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testProofRenderer,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import { TEST_RELEASE_ID } from "@repo/backend/test/content/release";
import {
  recomputeContentProof,
  stageUpsertFixture,
} from "@repo/backend/test/content/verify";
import { convexTest, type TestConvex } from "convex-test";
import { Data, Effect, Schema, Stream } from "effect";

const releaseId = ReleaseIdSchema.make("release-proof");
const manifest = testEmptyManifest(releaseId);
const signedRelease = testSignedRelease(manifest);
const manifestHash = signedRelease.manifestHash;

class ObservedProofFailure extends Schema.TaggedError<ObservedProofFailure>()(
  "ObservedProofFailure",
  { cause: Schema.Unknown }
) {}

class UnexpectedProofTestState extends Data.TaggedError(
  "UnexpectedProofTestState"
)<{
  readonly operation:
    | "load-candidate-manifest"
    | "load-proof-release"
    | "load-staged-artifact";
}> {}

/** Creates one isolated database for the production proof program. */
function createProofTest() {
  return convexTest(schema, convexModules);
}

/** Observes the production proof across convex-test's component limitation. */
const runProof = Effect.fn("contentRelease.proof.verify.test.runProof")(
  function* (
    t: TestConvex<typeof schema>,
    options: {
      readonly hash?: string;
      readonly releaseId?: string;
      readonly resolver?: typeof TEST_KEY_RESOLVER;
    } = {}
  ) {
    const hash = options.hash ?? manifestHash;
    const proofReleaseId = options.releaseId ?? releaseId;
    const resolver = options.resolver ?? TEST_KEY_RESOLVER;
    return yield* Effect.tryPromise({
      catch: (cause) => new ObservedProofFailure({ cause }),
      try: () => recomputeContentProof(t, hash, proofReleaseId, resolver),
    });
  }
);

/** Inserts one empty but fully authenticated staged release. */
const insertRelease = Effect.fn(
  "contentRelease.proof.verify.test.insertRelease"
)(function* (ctx: MutationCtx) {
  const now = Date.UTC(2026, 6, 22, 12, 0, 0);
  yield* Effect.promise(() =>
    ctx.db.insert("contentReleases", {
      baseFamilies: [],
      checkedIndex: -1,
      checkedItems: 0,
      createdAt: now,
      releaseId,
      releaseJson: JSON.stringify(signedRelease),
      rendererJson: JSON.stringify(TEST_PROOF_RENDERER),
      resultFamilies: [...signedRelease.manifest.scope.families],
      role: "candidate",
      sequence: 1,
      stagedArtifacts: 0,
      stagedDeletes: 0,
      stagedItems: 0,
      stagedProjections: 0,
      stagedRoutes: 0,
      stagedSnapshotBatches: 0,
      stagedSnapshotRows: 0,
      stagedUpserts: 0,
      status: "staging",
      updatedAt: now,
    })
  );
  yield* Effect.promise(() =>
    ctx.db.insert("contentState", {
      articleSlot: "blue",
      candidateManifestHash: manifestHash,
      candidateReleaseId: releaseId,
      candidateSequence: 1,
      key: "primary",
      materialSlot: "blue",
      nextSequence: 2,
      searchSlot: "blue",
      updatedAt: now,
    })
  );
});

/** Inserts a multi-page authenticated delete-only release. */
const insertDeleteRelease = Effect.fn(
  "contentRelease.proof.verify.test.insertDeleteRelease"
)(function* (ctx: MutationCtx, count: number) {
  const items = Array.from({ length: count }, (_, index) =>
    ContentReleaseItemSchema.make({
      change: {
        contentKey: ContentKeySchema.make(`test:proof-${index}`),
        family: "material",
        artifactLocale: ArtifactLocaleSchema.make("en"),
        operation: "delete",
      },
      index,
      releaseId,
    })
  );
  const digest = yield* digestItems(releaseId, Stream.fromIterable(items)).pipe(
    Effect.orDie
  );
  const entries = items.map((item) => ({
    item,
    rollbackEntry: RollbackSnapshotEntrySchema.make({
      index: item.index,
      releaseId,
      snapshot: {
        contentKey: item.change.contentKey,
        family: item.change.family,
        artifactLocale: item.change.artifactLocale,
        state: "absent",
      },
    }),
  }));
  const rollback = yield* digestRollbackSnapshot(
    releaseId,
    Stream.fromIterable(entries.map(({ rollbackEntry }) => rollbackEntry))
  ).pipe(Effect.orDie);
  const nextManifest = ContentReleaseManifestSchema.make({
    ...manifest,
    deleteCount: count,
    itemCount: count,
    itemsDigest: digest.digest,
    rollbackCount: count,
    rollbackDigest: rollback.digest,
    upsertCount: 0,
  });
  const signed = testSignedRelease(nextManifest);
  const now = Date.UTC(2026, 6, 22, 12, 0, 0);
  yield* Effect.promise(() =>
    ctx.db.insert("contentReleases", {
      baseFamilies: [],
      checkedIndex: -1,
      checkedItems: 0,
      createdAt: now,
      releaseId,
      releaseJson: JSON.stringify(signed),
      rendererJson: JSON.stringify(TEST_PROOF_RENDERER),
      resultFamilies: [...signed.manifest.scope.families],
      role: "candidate",
      sequence: 1,
      stagedArtifacts: 0,
      stagedDeletes: count,
      stagedItems: count,
      stagedProjections: 0,
      stagedRoutes: 0,
      stagedSnapshotBatches: 0,
      stagedSnapshotRows: 0,
      stagedUpserts: 0,
      status: "staging",
      updatedAt: now,
    })
  );
  yield* Effect.promise(() =>
    ctx.db.insert("contentState", {
      articleSlot: "blue",
      candidateManifestHash: signed.manifestHash,
      candidateReleaseId: releaseId,
      candidateSequence: 1,
      key: "primary",
      materialSlot: "blue",
      nextSequence: 2,
      searchSlot: "blue",
      updatedAt: now,
    })
  );
  yield* Effect.forEach(
    entries,
    ({ item, rollbackEntry }) =>
      Effect.promise(() =>
        ctx.db.insert("contentItems", {
          artifactReady: false,
          contentKey: item.change.contentKey,
          index: item.index,
          itemBatchHash: digest.digest,
          itemBatchIndex: Math.floor(item.index / 4),
          itemJson: JSON.stringify(item),
          artifactLocale: item.change.artifactLocale,
          projectionReady: false,
          releaseId,
          rollbackJson: canonicalizeRollbackSnapshotEntry(rollbackEntry),
          sequence: 1,
          stagedAt: now,
        })
      ),
    { discard: true }
  );
  return signed.manifestHash;
});

/** Changes only the stored signature while preserving its claimed identity. */
const tamperArtifactSignature = Effect.fn(
  "contentRelease.proof.verify.test.tamperArtifactSignature"
)(function* (artifactJson: string) {
  const artifact = yield* Schema.decodeEffect(
    Schema.fromJsonString(SignedContentArtifactSchema)
  )(artifactJson);
  const firstCharacter = artifact.signature.startsWith("A") ? "B" : "A";
  const signature = Ed25519SignatureSchema.make(
    `${firstCharacter}${artifact.signature.slice(1)}`
  );
  return encodeArtifactJson({ ...artifact, signature });
});

/** Loads one staged proof release or defects on an invalid fixture. */
const loadProofRelease = Effect.fn(
  "contentRelease.proof.verify.test.loadProofRelease"
)(function* (ctx: MutationCtx) {
  const release = yield* Effect.promise(() =>
    ctx.db.query("contentReleases").unique()
  );
  if (!release) {
    return yield* Effect.die(
      new UnexpectedProofTestState({ operation: "load-proof-release" })
    );
  }
  return release;
});

/** Corrupts the frozen renderer while preserving the release identity. */
const driftStoredRenderer = Effect.fn(
  "contentRelease.proof.verify.test.driftStoredRenderer"
)(function* (ctx: MutationCtx) {
  const release = yield* loadProofRelease(ctx);
  yield* Effect.promise(() =>
    ctx.db.patch("contentReleases", release._id, {
      rendererJson: JSON.stringify(testProofRenderer("h1")),
    })
  );
});

/** Corrupts durable counters after the release entered verification. */
const driftDurableCounters = Effect.fn(
  "contentRelease.proof.verify.test.driftDurableCounters"
)(function* (ctx: MutationCtx) {
  const release = yield* loadProofRelease(ctx);
  yield* Effect.promise(() =>
    ctx.db.patch("contentReleases", release._id, {
      stagedItems: 1,
      status: "verifying",
    })
  );
});

/** Corrupts one staged artifact signature inside the real test transaction. */
const tamperStoredArtifact = Effect.fn(
  "contentRelease.proof.verify.test.tamperStoredArtifact"
)(function* (ctx: MutationCtx) {
  const artifact = yield* Effect.promise(() =>
    ctx.db.query("contentArtifacts").unique()
  );
  if (!artifact) {
    return yield* Effect.die(
      new UnexpectedProofTestState({ operation: "load-staged-artifact" })
    );
  }
  const artifactJson = yield* tamperArtifactSignature(
    artifact.artifactJson
  ).pipe(Effect.orDie);
  yield* Effect.promise(() =>
    ctx.db.patch("contentArtifacts", artifact._id, { artifactJson })
  );
});

describe("contentRelease/proof/verify", () => {
  it.effect(
    "recomputes an authenticated empty proof and commits it exactly once",
    Effect.fn("contentRelease.proof.verify.test.recomputesEmptyProof")(
      function* () {
        const t = createProofTest();
        yield* Effect.promise(() =>
          t.mutation((ctx) => runConvexProgram(insertRelease(ctx)))
        );

        const proof = yield* runProof(t);
        const release = yield* Effect.promise(() =>
          t.run((ctx) => ctx.db.query("contentReleases").unique())
        );

        expect(proof).toMatchObject({
          itemCount: 0,
          manifestHash,
          releaseId,
          stagedArtifacts: 0,
        });
        expect(release).toMatchObject({
          checkedItems: 0,
          proofJson: JSON.stringify(proof),
          status: "verifying",
        });
      }
    )
  );

  it.effect(
    "fails closed when no production key has been reviewed",
    Effect.fn("contentRelease.proof.verify.test.rejectsMissingKey")(
      function* () {
        const t = createProofTest();
        yield* Effect.promise(() =>
          t.mutation((ctx) => runConvexProgram(insertRelease(ctx)))
        );

        const failure = yield* runProof(t, {
          resolver: contentKeyResolver,
        }).pipe(Effect.flip);
        expect(getUnknownErrorMessage(failure.cause)).toContain(
          "Content release verification failed with SigningKeyNotFoundError."
        );
      }
    )
  );

  it.effect(
    "recovers stable internal failures into the typed channel",
    Effect.fn("contentRelease.proof.verify.test.recoversTypedFailure")(
      function* () {
        const t = createProofTest();

        const result = yield* Effect.promise(() =>
          t.action((ctx) =>
            runConvexActionProgram(
              recomputeProgram(ctx, manifestHash, releaseId, 0).pipe(
                Effect.match({
                  onFailure: (error) => ({
                    code: error.code,
                    tag: error._tag,
                  }),
                  onSuccess: () => ({ code: null, tag: null }),
                }),
                Effect.provideService(
                  ContentVerificationKeyResolver,
                  TEST_KEY_RESOLVER
                )
              )
            )
          )
        );

        expect(result).toEqual({
          code: "CONTENT_RELEASE_MISSING",
          tag: "ReleaseError",
        });
      }
    )
  );

  it.effect(
    "replays multi-page item and proof streams before committing",
    Effect.fn("contentRelease.proof.verify.test.replaysPagedProof")(
      function* () {
        const t = createProofTest();
        const hash = yield* Effect.promise(() =>
          t.mutation((ctx) => runConvexProgram(insertDeleteRelease(ctx, 9)))
        );

        const proof = yield* runProof(t, { hash });
        expect(proof).toMatchObject({
          deleteHeads: 9,
          itemCount: 9,
          stagedArtifacts: 0,
          upsertHeads: 0,
        });
      }
    )
  );

  it.effect(
    "rejects renderer and durable counter drift",
    Effect.fn("contentRelease.proof.verify.test.rejectsDurableDrift")(
      function* () {
        const rendererDrift = createProofTest();
        yield* Effect.promise(() =>
          rendererDrift.mutation((ctx) => runConvexProgram(insertRelease(ctx)))
        );
        yield* Effect.promise(() =>
          rendererDrift.mutation((ctx) =>
            runConvexProgram(driftStoredRenderer(ctx))
          )
        );
        const rendererFailure = yield* runProof(rendererDrift).pipe(
          Effect.flip
        );
        expect(getUnknownErrorMessage(rendererFailure.cause)).toContain(
          "no longer matches its frozen renderer"
        );

        const counters = createProofTest();
        yield* Effect.promise(() =>
          counters.mutation((ctx) => runConvexProgram(insertRelease(ctx)))
        );
        yield* Effect.promise(() =>
          counters.mutation((ctx) =>
            runConvexProgram(driftDurableCounters(ctx))
          )
        );
        const counterFailure = yield* runProof(counters).pipe(Effect.flip);
        expect(getUnknownErrorMessage(counterFailure.cause)).toContain(
          "lost durable progress"
        );
      }
    )
  );

  it.effect(
    "reauthenticates stored artifacts before committing proof",
    Effect.fn("contentRelease.proof.verify.test.reauthenticatesArtifacts")(
      function* () {
        const t = createProofTest();
        yield* Effect.promise(() => stageUpsertFixture(t));
        const state = yield* Effect.promise(() =>
          t.run((ctx) => ctx.db.query("contentState").unique())
        );
        if (!state?.candidateManifestHash) {
          return yield* Effect.die(
            new UnexpectedProofTestState({
              operation: "load-candidate-manifest",
            })
          );
        }
        yield* Effect.promise(() =>
          t.mutation((ctx) => runConvexProgram(tamperStoredArtifact(ctx)))
        );

        const failure = yield* runProof(t, {
          hash: state.candidateManifestHash,
          releaseId: TEST_RELEASE_ID,
        }).pipe(Effect.flip);
        expect(getUnknownErrorMessage(failure.cause)).toContain(
          "Content release verification failed"
        );
        const release = yield* Effect.promise(() =>
          t.run((ctx) => ctx.db.query("contentReleases").unique())
        );
        expect(release?.proofJson).toBeUndefined();
      }
    )
  );
});
