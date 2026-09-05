import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { decodeArtifactJson } from "@repo/backend/convex/contentRelease/parse";
import { getTryoutSectionContentAccess } from "@repo/backend/convex/tryouts/runtime/content";
import { tryRuntimePromise } from "@repo/backend/convex/tryouts/runtime/error";
import {
  TryoutHistoryError,
  type TryoutHistoryRequest,
} from "@repo/backend/convex/tryouts/runtime/history/spec";
import { Effect } from "effect";

type TryoutHistorySelector = TryoutHistoryRequest["selectors"][number];

/** Resolves exact frozen membership and section access without parsing old rows. */
export const readHistoryPlacement = Effect.fn("tryouts.history.readPlacement")(
  function* (
    ctx: QueryCtx,
    attempt: Doc<"tryoutAttempts">,
    selector: TryoutHistorySelector
  ) {
    if (
      selector.appLocale !== attempt.appLocale ||
      selector.bundleHash !== attempt.tryoutBundleHash ||
      selector.snapshotId !== attempt.tryoutSnapshotId ||
      selector.snapshotReleaseId !== attempt.snapshotReleaseId
    ) {
      return null;
    }
    const sectionSnapshot = attempt.sectionSnapshots.find(
      (section) => section.sectionKey === selector.sectionKey
    );
    if (!sectionSnapshot) {
      return null;
    }
    const section = yield* tryRuntimePromise(() =>
      ctx.db
        .query("tryoutSectionAttempts")
        .withIndex("by_tryoutAttemptId_and_sectionKey", (index) =>
          index
            .eq("tryoutAttemptId", attempt._id)
            .eq("sectionKey", selector.sectionKey)
        )
        .unique()
    );
    if (!section) {
      return null;
    }
    if (
      section.sectionIdentity !== sectionSnapshot.sectionIdentity ||
      section.sectionOrder !== sectionSnapshot.sectionOrder ||
      section.totalQuestions !== sectionSnapshot.questionCount
    ) {
      return yield* historyIntegrity(
        "Try-out section lost its frozen identity."
      );
    }
    const access = getTryoutSectionContentAccess(
      attempt.status,
      section.status
    );
    if (
      !access.questions ||
      (selector.delivery === "entitled" && !access.answers)
    ) {
      return null;
    }
    const frozen = yield* tryRuntimePromise(() =>
      ctx.db
        .query("tryoutAttemptPlacements")
        .withIndex(
          "by_tryoutAttemptId_and_sectionKey_and_questionOrder",
          (index) =>
            index
              .eq("tryoutAttemptId", attempt._id)
              .eq("sectionKey", selector.sectionKey)
              .eq("questionOrder", selector.questionOrder)
        )
        .unique()
    );
    const question = selector.delivery === "authenticated";
    if (
      !frozen ||
      frozen.contentHash !== selector.contentHash ||
      frozen.sourcePath !== selector.sourcePath ||
      frozen.sourceRevision !== selector.sourceRevision ||
      (question ? frozen.questionArtifactHash : frozen.answerArtifactHash) !==
        selector.artifactHash ||
      (question ? frozen.questionContentKey : frozen.answerContentKey) !==
        selector.contentKey
    ) {
      return null;
    }
    const retained = yield* tryRuntimePromise(() =>
      ctx.db
        .query("tryoutPlacements")
        .withIndex("by_snapshotId_and_identity", (index) =>
          index
            .eq("snapshotId", attempt.tryoutSnapshotId)
            .eq("identity", frozen.placementIdentity)
        )
        .unique()
    );
    if (
      !retained ||
      retained.rowHash !== frozen.placementRowHash ||
      retained.appLocale !== attempt.appLocale ||
      retained.countryKey !== attempt.countryKey ||
      retained.examKey !== attempt.examKey ||
      retained.trackKey !== attempt.trackKey ||
      retained.setKey !== attempt.setKey ||
      retained.sectionKey !== frozen.sectionKey ||
      retained.questionOrder !== frozen.questionOrder ||
      retained.contentHash !== frozen.contentHash ||
      retained.questionArtifactHash !== frozen.questionArtifactHash ||
      retained.answerArtifactHash !== frozen.answerArtifactHash ||
      frozen.sectionIdentity !== sectionSnapshot.sectionIdentity
    ) {
      return yield* historyIntegrity(
        "Try-out placement lost its original snapshot membership."
      );
    }
    return {
      artifactLocale: question
        ? retained.questionArtifactLocale
        : retained.answerArtifactLocale,
      frozen,
      selector,
    };
  }
);

/** Returns an unchanged artifact only after its exact frozen body checks pass. */
export const readHistoryArtifact = Effect.fn("tryouts.history.readArtifact")(
  function* (
    ctx: QueryCtx,
    placement: NonNullable<
      Effect.Success<ReturnType<typeof readHistoryPlacement>>
    >
  ) {
    const { artifactLocale, frozen, selector } = placement;
    const stored = yield* tryRuntimePromise(() =>
      ctx.db
        .query("contentArtifacts")
        .withIndex("by_artifactHash", (index) =>
          index.eq("artifactHash", selector.artifactHash)
        )
        .unique()
    );
    if (!stored) {
      return yield* historyIntegrity("Try-out placement lost its signed body.");
    }
    const artifact = yield* decodeArtifactJson(stored.artifactJson);
    if (
      artifact.artifactHash !== selector.artifactHash ||
      artifact.payload.contentKey !== selector.contentKey ||
      artifact.payload.artifactLocale !== artifactLocale ||
      artifact.payload.rendererDomain !== frozen.rendererDomain
    ) {
      return yield* historyIntegrity(
        "Try-out body changed its frozen identity."
      );
    }
    const kind = selector.delivery === "authenticated" ? "question" : "answer";
    return {
      artifactJson: stored.artifactJson,
      delivery: selector.delivery,
      sourcePath: `${frozen.sourcePath}/${kind}.${artifactLocale}.mdx`,
    };
  }
);

/** Fails closed when a persisted attempt-owned content identity has drifted. */
function historyIntegrity(message: string) {
  return new TryoutHistoryError({ code: "TRYOUT_HISTORY_INTEGRITY", message });
}
