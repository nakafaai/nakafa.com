import type { Sha256Hash } from "@nakafa/aksara-contracts/ids";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";

type AttemptPage = Extract<
  NonNullable<
    FunctionReturnType<typeof api.tryouts.queries.attemptPage.getSection>
  >,
  { kind: "retained" }
>;
type ContentAccess = AttemptPage["content"];
export type SignedContentAccess = Extract<ContentAccess, { kind: "signed" }>;
export type CurrentContentAccess = Extract<
  SignedContentAccess,
  { runtime: "current" }
>;
export type HistoryContentAccess = Extract<
  SignedContentAccess,
  { runtime: "history" }
>;

export type CurrentTryoutQuestionSelector =
  CurrentContentAccess["questions"][number];
export type CurrentTryoutAnswerSelector =
  CurrentContentAccess["answers"][number];
export type HistoryTryoutQuestionSelector =
  HistoryContentAccess["questions"][number];
export type HistoryTryoutAnswerSelector =
  HistoryContentAccess["answers"][number];
export type CurrentTryoutSelector =
  | CurrentTryoutAnswerSelector
  | CurrentTryoutQuestionSelector;
export type HistoryTryoutSelector =
  | HistoryTryoutAnswerSelector
  | HistoryTryoutQuestionSelector;
export type TryoutRenderSelector = Pick<
  CurrentTryoutQuestionSelector,
  "contentHash" | "sourcePath" | "sourceRevision"
>;

/** Rendered question body paired with its immutable attempt identity. */
export interface TryoutQuestionContent {
  readonly content: ReactNode;
  readonly contentHash: string;
  readonly sourcePath: string;
  readonly sourceRevision: string;
}

/** Rendered answer body paired with its immutable attempt identity. */
export interface TryoutAnswerContent {
  readonly answer: ReactNode;
  readonly contentHash: string;
  readonly sourcePath: string;
  readonly sourceRevision: string;
}

/** Rendered signed content needed by one exact try-out runtime. */
export interface TryoutRuntimeContent {
  readonly answers: readonly TryoutAnswerContent[];
  readonly questions: readonly TryoutQuestionContent[];
}

/** One authenticated and rendered artifact before question/answer projection. */
export interface RenderedTryoutContentEntry {
  readonly artifactHash: Sha256Hash;
  readonly body: ReactNode;
  readonly contentHash: string;
  readonly sourcePath: string;
  readonly sourceRevision: string;
}

/** Projects ordered rendered entries into the exact runtime view model. */
export function projectTryoutRuntimeContent(input: {
  readonly answers: readonly RenderedTryoutContentEntry[];
  readonly questions: readonly RenderedTryoutContentEntry[];
}): TryoutRuntimeContent {
  return {
    answers: input.answers.map(
      ({ body, contentHash, sourcePath, sourceRevision }) => ({
        answer: body,
        contentHash,
        sourcePath,
        sourceRevision,
      })
    ),
    questions: input.questions.map(
      ({ body, contentHash, sourcePath, sourceRevision }) => ({
        content: body,
        contentHash,
        sourcePath,
        sourceRevision,
      })
    ),
  };
}

/** Exact signed question selector authorized by Convex. */
export type TryoutQuestionSelector = SignedContentAccess["questions"][number];
