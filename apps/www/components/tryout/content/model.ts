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
type SignedContentAccess = Extract<ContentAccess, { kind: "signed" }>;

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

/** Exact signed question selector authorized by Convex. */
export type TryoutQuestionSelector = SignedContentAccess["questions"][number];

/** Exact signed answer selector authorized by Convex. */
export type TryoutAnswerSelector = SignedContentAccess["answers"][number];
