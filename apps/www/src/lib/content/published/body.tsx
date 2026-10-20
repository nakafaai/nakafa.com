import "@tanstack/react-start/server-only";
import type { SignedContentArtifact } from "@nakafa/aksara-contracts/content";

import { renderServerComponent } from "@tanstack/react-start/rsc";
import { Effect } from "effect";
import { evaluateVerifiedArtifact } from "@/lib/content/published/artifact";
import { ContentExecutionError } from "@/lib/content/published/errors";

/**
 * Renders a verified body as a server component tree. Its text, math and frames
 * are server markup, and each interactive visual is a client reference that its
 * own boundary loads, so the body ships no JavaScript it does not run.
 */
async function renderVerifiedBody(artifact: SignedContentArtifact) {
  const rendered = await Effect.runPromise(
    evaluateVerifiedArtifact({ artifact })
  );
  return await renderServerComponent(<rendered.Content />);
}

/**
 * Reads the body of one signed artifact. Any failure becomes one content
 * execution error, which names the content and the stage and nothing else.
 */
export const readRenderedBody = Effect.fn("NakafaContent.readRenderedBody")(
  (artifact: SignedContentArtifact) =>
    Effect.tryPromise({
      try: () => renderVerifiedBody(artifact),
      catch: () =>
        new ContentExecutionError({
          contentKey: artifact.payload.contentKey,
          stage: "evaluate",
        }),
    })
);
