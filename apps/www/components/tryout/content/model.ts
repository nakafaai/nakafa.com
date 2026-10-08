import type { Sha256Hash } from "@nakafa/aksara-contracts/ids";
import type {
  noTryoutSectionContentAccess,
  TryoutSectionContentAccess,
} from "@repo/backend/confect/tryouts/runtime/spec";
import type { ReactNode } from "react";

/** Signed section content access: every access except the explicit none value. */
export type SignedContentAccess = Exclude<
  TryoutSectionContentAccess,
  typeof noTryoutSectionContentAccess
>;
export type TryoutQuestionSelector = SignedContentAccess["questions"][number];
export type TryoutAnswerSelector = SignedContentAccess["answers"][number];
export type TryoutSelector = TryoutAnswerSelector | TryoutQuestionSelector;
type TryoutRenderSelector = Pick<
  TryoutQuestionSelector,
  "contentHash" | "sourcePath" | "sourceRevision"
>;

/** Pairs one verified artifact body with the immutable identity of its selector. */
export function makeRenderedTryoutContentEntry(
  selector: TryoutRenderSelector,
  artifactHash: Sha256Hash,
  body: ReactNode
) {
  return {
    artifactHash,
    body,
    contentHash: selector.contentHash,
    sourcePath: selector.sourcePath,
    sourceRevision: selector.sourceRevision,
  };
}

/** One authenticated and rendered artifact before question/answer projection. */
export type RenderedTryoutContentEntry = ReturnType<
  typeof makeRenderedTryoutContentEntry
>;

/** Projects ordered rendered entries into the exact runtime view model. */
export function projectTryoutRuntimeContent(input: {
  readonly answers: readonly RenderedTryoutContentEntry[];
  readonly questions: readonly RenderedTryoutContentEntry[];
}) {
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

/** Rendered signed content needed by one exact try-out runtime. */
export type TryoutRuntimeContent = ReturnType<
  typeof projectTryoutRuntimeContent
>;

/** Rendered answer body paired with its immutable attempt identity. */
export type TryoutAnswerContent = TryoutRuntimeContent["answers"][number];

/** Rendered question body paired with its immutable attempt identity. */
export type TryoutQuestionContent = TryoutRuntimeContent["questions"][number];
