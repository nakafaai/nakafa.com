import "@tanstack/react-start/server-only";
import type { SignedContentArtifact } from "@nakafa/aksara-contracts/content";

import { renderServerComponent } from "@tanstack/react-start/rsc";
import { Effect } from "effect";
import { evaluateVerifiedArtifact } from "@/lib/content/published/artifact";
import { ContentExecutionError } from "@/lib/content/published/errors";

/** The execution failure of one body, which names the content and the stage and nothing else. */
const executionError = (artifact: SignedContentArtifact) =>
  new ContentExecutionError({
    contentKey: artifact.payload.contentKey,
    stage: "evaluate",
  });

/**
 * Reads the body of one signed artifact as a server component tree. Its text,
 * math and frames are server markup, and each interactive visual is a client
 * reference that its own boundary loads, so the body ships no JavaScript it does
 * not run. A failed evaluation or render becomes one execution error.
 */
export const readRenderedBody = Effect.fn("NakafaContent.readRenderedBody")(
  function* (artifact: SignedContentArtifact) {
    const rendered = yield* evaluateVerifiedArtifact({ artifact }).pipe(
      Effect.mapError(() => executionError(artifact))
    );
    return yield* Effect.tryPromise({
      try: () => renderServerComponent(<rendered.Content />),
      catch: () => executionError(artifact),
    });
  }
);
