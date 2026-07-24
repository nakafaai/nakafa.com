import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { decodeArtifactJson } from "@repo/backend/convex/contentRelease/parse";
import {
  TryoutContentError,
  tryoutContentErrorCode,
  tryoutContentFail,
} from "@repo/backend/convex/tryouts/content/spec";
import { Effect } from "effect";

type ArtifactKind = "answer" | "question";
type Placement = Doc<"tryoutAttemptPlacements">;

/** Decodes one stored artifact into the try-out failure channel. */
const decodeStoredArtifact = Effect.fn("tryouts.decodeStoredArtifact")(
  (artifactJson: string, artifactHash: string) =>
    decodeArtifactJson(artifactJson).pipe(
      Effect.mapError(
        () =>
          new TryoutContentError({
            code: tryoutContentErrorCode.integrity,
            message: `Frozen try-out artifact ${artifactHash} is invalid.`,
          })
      )
    )
);

/** Resolves one immutable artifact and binds it to its frozen placement. */
const resolveArtifact = Effect.fn("tryouts.resolveArtifact")(function* (
  ctx: QueryCtx,
  input: {
    artifactHash: string;
    contentKey: string;
    kind: ArtifactKind;
    locale: "en" | "id";
    rendererDomain: NonNullable<Placement["rendererDomain"]>;
  }
) {
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("contentArtifacts")
      .withIndex("by_artifactHash", (query) =>
        query.eq("artifactHash", input.artifactHash)
      )
      .unique()
  );
  if (!stored) {
    return yield* tryoutContentFail(
      tryoutContentErrorCode.missing,
      `Frozen try-out ${input.kind} artifact is missing.`
    );
  }

  const artifact = yield* decodeStoredArtifact(
    stored.artifactJson,
    input.artifactHash
  );
  if (
    stored.artifactHash !== input.artifactHash ||
    artifact.artifactHash !== input.artifactHash ||
    artifact.payload.contentKey !== input.contentKey ||
    artifact.payload.locale !== input.locale ||
    artifact.payload.rendererDomain !== input.rendererDomain
  ) {
    return yield* tryoutContentFail(
      tryoutContentErrorCode.integrity,
      `Frozen try-out ${input.kind} artifact mismatches its placement.`
    );
  }

  return stored.artifactJson;
});

/** Requires every additive placement reference before runtime cutover. */
const readPlacementReferences = Effect.fn("tryouts.readPlacementReferences")(
  function* (placement: Placement) {
    const {
      answerArtifactHash,
      answerContentKey,
      questionArtifactHash,
      questionContentKey,
      rendererDomain,
      sectionKey,
    } = placement;
    if (
      !(
        answerArtifactHash &&
        answerContentKey &&
        questionArtifactHash &&
        questionContentKey &&
        rendererDomain &&
        sectionKey
      )
    ) {
      return yield* tryoutContentFail(
        tryoutContentErrorCode.migration,
        "Try-out placement does not have complete frozen content references."
      );
    }

    const questionSuffix = "/question";
    const expectedAnswerKey = `${questionContentKey.slice(
      0,
      -questionSuffix.length
    )}/answer`;
    if (
      !questionContentKey.endsWith(questionSuffix) ||
      answerContentKey !== expectedAnswerKey
    ) {
      return yield* tryoutContentFail(
        tryoutContentErrorCode.integrity,
        "Frozen try-out question and answer identities do not form one pair."
      );
    }

    return {
      answerArtifactHash,
      answerContentKey,
      questionArtifactHash,
      questionContentKey,
      rendererDomain,
      sectionKey,
    };
  }
);

/** Resolves one ordered placement without exposing answer bytes while active. */
export const resolvePlacement = Effect.fn("tryouts.resolvePlacement")(
  function* (
    ctx: QueryCtx,
    input: {
      includeAnswer: boolean;
      locale: "en" | "id";
      placement: Placement;
      sectionKey: string;
    }
  ) {
    const references = yield* readPlacementReferences(input.placement);
    if (references.sectionKey !== input.sectionKey) {
      return yield* tryoutContentFail(
        tryoutContentErrorCode.integrity,
        "Frozen try-out placement belongs to a different section."
      );
    }

    const questionArtifactJson = yield* resolveArtifact(ctx, {
      artifactHash: references.questionArtifactHash,
      contentKey: references.questionContentKey,
      kind: "question",
      locale: input.locale,
      rendererDomain: references.rendererDomain,
    });
    if (!input.includeAnswer) {
      return {
        placementId: input.placement._id,
        questionArtifactJson,
      };
    }

    const answerArtifactJson = yield* resolveArtifact(ctx, {
      artifactHash: references.answerArtifactHash,
      contentKey: references.answerContentKey,
      kind: "answer",
      locale: input.locale,
      rendererDomain: references.rendererDomain,
    });
    return {
      answerArtifactJson,
      placementId: input.placement._id,
      questionArtifactJson,
    };
  }
);
