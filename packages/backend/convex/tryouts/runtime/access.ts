import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { getOptionalAppUserForRead } from "@repo/backend/convex/lib/helpers/auth";
import {
  getTryoutSectionContentAccess,
  type TryoutAnswerSelector,
  type TryoutQuestionSelector,
  type TryoutSectionContentAccess,
  type TryoutSectionContentArgs,
} from "@repo/backend/convex/tryouts/runtime/content";
import { readLatestAttempt } from "@repo/backend/convex/tryouts/runtime/lookup";
import { Effect, Schema } from "effect";

const noContentAccess: Extract<TryoutSectionContentAccess, { kind: "none" }> = {
  kind: "none",
};

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutPlacement = Doc<"tryoutAttemptPlacements">;

/** Stable failure while reading one attempt-owned content capability. */
class TryoutContentReadError extends Schema.TaggedError<TryoutContentReadError>()(
  "TryoutContentReadError",
  {
    cause: Schema.optional(Schema.Unknown),
    code: Schema.Literal("TRYOUT_CONTENT_INTEGRITY"),
    message: Schema.String,
  }
) {}

/** Resolves content access from the current user's latest owned attempt. */
export const readTryoutSectionContent = Effect.fn(
  "tryouts.access.readSectionContent"
)(function* (ctx: QueryCtx, args: TryoutSectionContentArgs) {
  const auth = yield* tryContentPromise(() => getOptionalAppUserForRead(ctx));
  if (!auth) {
    return noContentAccess;
  }

  const attempt = yield* readLatestAttempt(ctx, args, auth.appUser._id);
  if (!attempt) {
    return noContentAccess;
  }

  const requestedSection = yield* tryContentPromise(() =>
    ctx.db
      .query("tryoutSectionAttempts")
      .withIndex("by_tryoutAttemptId_and_sectionKey", (index) =>
        index
          .eq("tryoutAttemptId", attempt._id)
          .eq("sectionKey", args.sectionKey)
      )
      .unique()
  );
  const section = requestedSection ?? (yield* loadActiveSection(ctx, attempt));
  if (!section) {
    return noContentAccess;
  }

  const access = getTryoutSectionContentAccess(attempt.status, section.status);
  if (!access.questions) {
    return noContentAccess;
  }

  const snapshotId = attempt.tryoutSnapshotId;
  if (!snapshotId) {
    const filesystemAccess: Extract<
      TryoutSectionContentAccess,
      { kind: "filesystem" }
    > = { ...access, kind: "filesystem" };
    return filesystemAccess;
  }

  return yield* loadSignedContent({
    access,
    attempt,
    ctx,
    locale: args.locale,
    sectionKey: section.sectionKey,
    snapshotId,
    totalQuestions: section.totalQuestions,
  });
});

/** Resolves one bounded active section when its published route key changed. */
const loadActiveSection = Effect.fn("tryouts.access.loadActiveSection")(
  function* (ctx: QueryCtx, attempt: TryoutAttempt) {
    if (attempt.status !== "in-progress") {
      return null;
    }

    const sections = yield* tryContentPromise(() =>
      ctx.db
        .query("tryoutSectionAttempts")
        .withIndex("by_tryoutAttemptId_and_sectionOrder", (index) =>
          index.eq("tryoutAttemptId", attempt._id)
        )
        .take(attempt.sectionSnapshots.length + 1)
    );
    if (sections.length > attempt.sectionSnapshots.length) {
      return yield* contentIntegrity(
        "Try-out section attempt count exceeds its frozen snapshot."
      );
    }

    return sections.find((section) => section.status === "in-progress") ?? null;
  }
);

/** Returns exact protected selectors from one immutable signed attempt. */
const loadSignedContent = Effect.fn("tryouts.access.loadSignedContent")(
  function* (input: {
    readonly access: { readonly answers: boolean; readonly questions: boolean };
    readonly attempt: TryoutAttempt;
    readonly ctx: QueryCtx;
    readonly locale: TryoutSectionContentArgs["locale"];
    readonly sectionKey: string;
    readonly snapshotId: string;
    readonly totalQuestions: number;
  }) {
    if (input.attempt.locale !== input.locale) {
      return yield* contentIntegrity(
        "Signed try-out attempt lost its locale or snapshot identity."
      );
    }

    const placements = yield* tryContentPromise(() =>
      input.ctx.db
        .query("tryoutAttemptPlacements")
        .withIndex(
          "by_tryoutAttemptId_and_sectionKey_and_questionOrder",
          (index) =>
            index
              .eq("tryoutAttemptId", input.attempt._id)
              .eq("sectionKey", input.sectionKey)
        )
        .take(input.totalQuestions + 1)
    );
    if (placements.length !== input.totalQuestions) {
      return yield* contentIntegrity(
        "Signed try-out section lost one or more frozen placements."
      );
    }

    const content: Extract<TryoutSectionContentAccess, { kind: "signed" }> = {
      answers: input.access.answers
        ? yield* Effect.forEach(placements, (placement) =>
            makeAnswerSelector(placement, input.locale, input.snapshotId)
          )
        : [],
      kind: "signed",
      questions: yield* Effect.forEach(placements, (placement) =>
        makeQuestionSelector(placement, input.locale, input.snapshotId)
      ),
    };
    return content;
  }
);

/** Builds one authenticated question selector from a frozen placement. */
function makeQuestionSelector(
  placement: TryoutPlacement,
  locale: TryoutSectionContentArgs["locale"],
  snapshotId: string
) {
  if (
    !(
      placement.questionArtifactHash &&
      placement.questionContentKey &&
      placement.sectionKey
    )
  ) {
    return contentIntegrity("Signed try-out question selector is incomplete.");
  }

  const selector: TryoutQuestionSelector = {
    artifactHash: placement.questionArtifactHash,
    contentHash: placement.contentHash,
    contentKey: placement.questionContentKey,
    delivery: "authenticated",
    locale,
    questionOrder: placement.questionOrder,
    snapshotId,
    sourcePath: placement.sourcePath,
    sourceRevision: placement.sourceRevision,
  };
  return Effect.succeed(selector);
}

/** Builds one entitled answer selector from a frozen placement. */
function makeAnswerSelector(
  placement: TryoutPlacement,
  locale: TryoutSectionContentArgs["locale"],
  snapshotId: string
) {
  if (!(placement.answerArtifactHash && placement.answerContentKey)) {
    return contentIntegrity("Signed try-out answer selector is incomplete.");
  }

  const selector: TryoutAnswerSelector = {
    artifactHash: placement.answerArtifactHash,
    contentHash: placement.contentHash,
    contentKey: placement.answerContentKey,
    delivery: "entitled",
    locale,
    questionOrder: placement.questionOrder,
    snapshotId,
    sourcePath: placement.sourcePath,
    sourceRevision: placement.sourceRevision,
  };
  return Effect.succeed(selector);
}

/** Creates one typed fail-closed content integrity error. */
function contentIntegrity(message: string) {
  return new TryoutContentReadError({
    code: "TRYOUT_CONTENT_INTEGRITY",
    message,
  });
}

/** Lifts one Convex read into the typed content error channel. */
function tryContentPromise<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: (cause) =>
      new TryoutContentReadError({
        cause,
        code: "TRYOUT_CONTENT_INTEGRITY",
        message: "Unable to read try-out content access.",
      }),
    try: operation,
  });
}
