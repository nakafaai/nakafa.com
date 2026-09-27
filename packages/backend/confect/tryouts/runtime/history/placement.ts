import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { decodeArtifactJson } from "@repo/backend/confect/contentRelease/parse";
import { readAttemptAnswer } from "@repo/backend/confect/tryouts/runtime/answer";
import { readTryoutSectionContentAccess } from "@repo/backend/confect/tryouts/runtime/content";
import { toTryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import {
  TryoutHistoryError,
  type TryoutHistoryRequest,
} from "@repo/backend/confect/tryouts/runtime/history/spec";
import { Effect } from "effect";

type TryoutHistorySelector = TryoutHistoryRequest["selectors"][number];

/** Resolves exact frozen membership and section access without parsing old rows. */
export const readHistoryPlacement = Effect.fn("tryouts.history.readPlacement")(
  function* (attempt: Docs["tryoutAttempts"], selector: TryoutHistorySelector) {
    const database = yield* DatabaseReader;
    if (
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
    const section = yield* database
      .table("tryoutSectionAttempts")
      .get(
        "by_tryoutAttemptId_and_sectionKey",
        attempt._id,
        selector.sectionKey
      )
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.mapError(toTryoutRuntimeError)
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
    const access = yield* readTryoutSectionContentAccess(
      attempt,
      section.status
    );
    if (
      !access.questions ||
      (selector.delivery === "entitled" && !access.answers)
    ) {
      return null;
    }
    const frozen = yield* database
      .table("tryoutAttemptPlacements")
      .get(
        "by_tryoutAttemptId_and_sectionKey_and_questionOrder",
        attempt._id,
        selector.sectionKey,
        selector.questionOrder
      )
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.mapError(toTryoutRuntimeError)
      );
    const question = selector.delivery === "authenticated";
    if (
      !frozen ||
      frozen.contentHash !== selector.contentHash ||
      frozen.sourcePath !== selector.sourcePath ||
      frozen.sourceRevision !== selector.sourceRevision ||
      (question ? frozen.questionContentKey : frozen.answerContentKey) !==
        selector.contentKey
    ) {
      return null;
    }
    const retained = yield* database
      .table("tryoutPlacements")
      .get(
        "by_snapshotId_and_identity",
        attempt.tryoutSnapshotId,
        frozen.placementIdentity
      )
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.mapError(toTryoutRuntimeError)
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
    const body = question
      ? {
          artifactHash: frozen.questionArtifactHash,
          artifactLocale: retained.questionArtifactLocale,
        }
      : yield* readAttemptAnswer(attempt, frozen, selector.appLocale);
    if (body.artifactHash !== selector.artifactHash) {
      return null;
    }
    return {
      artifactLocale: body.artifactLocale,
      frozen,
      selector,
    };
  }
);

/** Returns an unchanged artifact only after its exact frozen body checks pass. */
export const readHistoryArtifact = Effect.fn("tryouts.history.readArtifact")(
  function* (
    placement: NonNullable<
      Effect.Success<ReturnType<typeof readHistoryPlacement>>
    >
  ) {
    const database = yield* DatabaseReader;
    const { artifactLocale, frozen, selector } = placement;
    const stored = yield* database
      .table("contentArtifacts")
      .get("by_artifactHash", selector.artifactHash)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.mapError(toTryoutRuntimeError)
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
  return new TryoutHistoryError({
    code: "TRYOUT_HISTORY_INTEGRITY",
    message,
  });
}
