import { describe, expect, it } from "@effect/vitest";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  hashFinalizationPlacements,
  verifyFinalizationPlacements,
} from "@repo/backend/convex/contentRelease/finalize/proof";
import type { FinalizationAttemptSpec } from "@repo/backend/convex/contentRelease/finalize/spec";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { testTextHash } from "@repo/backend/test/content/release";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import { Effect } from "effect";

function makeSpec(
  placementDigest: FinalizationAttemptSpec["placementDigest"],
  totalQuestions: number
): FinalizationAttemptSpec {
  return {
    appLocale: AppLocaleSchema.make("id"),
    placementDigest,
    snapshotId: testTextHash("finalization-proof-snapshot"),
    snapshotReleaseId: "finalization-proof-release",
    targetBundleHash: testTextHash("finalization-proof-bundle"),
    totalQuestions,
  };
}

const seedPlacement = Effect.fn("test.finalize.seedPlacement")(function* () {
  const target = createConvexTestWithBetterAuth();
  yield* Effect.promise(() =>
    target.mutation((ctx) =>
      seedTryoutContentAccessState(ctx, {
        attemptStatus: "completed",
        sectionStatus: "completed",
        suffix: "finalization-proof",
      })
    )
  );
  const placements = yield* Effect.promise(() =>
    target.run((ctx) => ctx.db.query("tryoutAttemptPlacements").collect())
  );
  return { placements, target };
});

describe("contentRelease/finalize/proof", () => {
  it.effect("hashes and accepts one exact placement set", () =>
    Effect.gen(function* () {
      const { placements } = yield* seedPlacement();
      const digest = yield* hashFinalizationPlacements(placements);

      expect(digest).toBe(
        "sha256:1fb194e9c7f3cba6f9652f62f1a7ea0c1b11b6ea046abef4122cda261807d6f4"
      );
      expect(
        yield* verifyFinalizationPlacements(
          placements,
          makeSpec(digest, placements.length)
        )
      ).toBe(1);
    })
  );

  it.effect("rejects a duplicate section-local position", () =>
    Effect.gen(function* () {
      const { placements, target } = yield* seedPlacement();
      const placement = placements[0];
      expect(placement).toBeDefined();
      if (!placement) {
        return;
      }
      yield* Effect.promise(() =>
        target.mutation((ctx) =>
          ctx.db.insert("tryoutAttemptPlacements", {
            answerArtifactHash: placement.answerArtifactHash,
            answerContentKey: placement.answerContentKey,
            choiceSnapshots: placement.choiceSnapshots,
            contentHash: placement.contentHash,
            placementIdentity: `${placement.placementIdentity}-duplicate`,
            placementRowHash: placement.placementRowHash,
            questionArtifactHash: placement.questionArtifactHash,
            questionContentKey: placement.questionContentKey,
            questionOrder: placement.questionOrder,
            rendererDomain: placement.rendererDomain,
            sectionIdentity: placement.sectionIdentity,
            sectionKey: placement.sectionKey,
            sourcePath: placement.sourcePath,
            sourceRevision: placement.sourceRevision,
            tryoutAttemptId: placement.tryoutAttemptId,
          })
        )
      );
      const duplicated = yield* Effect.promise(() =>
        target.run((ctx) => ctx.db.query("tryoutAttemptPlacements").collect())
      );
      const digest = yield* hashFinalizationPlacements(duplicated);
      const failure = yield* verifyFinalizationPlacements(
        duplicated,
        makeSpec(digest, duplicated.length)
      ).pipe(Effect.flip);

      expect(failure.code).toBe("CONTENT_RELEASE_INTEGRITY");
    })
  );

  it.effect("rejects changed immutable placement bytes", () =>
    Effect.gen(function* () {
      const { placements, target } = yield* seedPlacement();
      const placement = placements[0];
      expect(placement).toBeDefined();
      if (!placement) {
        return;
      }
      const digest = yield* hashFinalizationPlacements(placements);
      yield* Effect.promise(() =>
        target.mutation((ctx) =>
          ctx.db.patch("tryoutAttemptPlacements", placement._id, {
            sourceRevision: "changed-source",
          })
        )
      );
      const changed = yield* Effect.promise(() =>
        target.run((ctx) => ctx.db.query("tryoutAttemptPlacements").collect())
      );
      const failure = yield* verifyFinalizationPlacements(
        changed,
        makeSpec(digest, changed.length)
      ).pipe(Effect.flip);

      expect(failure.code).toBe("CONTENT_RELEASE_INTEGRITY");
    })
  );
});
