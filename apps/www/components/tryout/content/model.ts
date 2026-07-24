import type { ReactNode } from "react";

/** Rendered question content bound only to its frozen placement identity. */
export interface TryoutQuestionContent {
  readonly content: ReactNode;
  readonly placementId: string;
}

/** Rendered answer content bound only to its frozen placement identity. */
export interface TryoutAnswerContent {
  readonly answer: ReactNode;
  readonly placementId: string;
}

/** Server-rendered content passed to the interactive try-out runtime. */
export interface TryoutRenderedContent {
  readonly answers: readonly TryoutAnswerContent[];
  readonly questions: readonly TryoutQuestionContent[];
}

/** One authenticated route request accepted by the private content seam. */
export interface TryoutContentRoute {
  readonly countryKey: string;
  readonly examKey: string;
  readonly locale: "en" | "id";
  readonly sectionKey: string;
  readonly setKey: string;
  readonly trackKey: string;
}
