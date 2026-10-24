import "@tanstack/react-start/server-only";

import type { SignedContentArtifact } from "@nakafa/aksara-contracts/content";
import { renderServerComponent } from "@tanstack/react-start/rsc";
import { Effect, Schema } from "effect";
import { captureServerExceptionSafely } from "@/lib/analytics/exception.server";
import { renderVerifiedArtifact } from "@/lib/content/published/artifact";
import { ContentExecutionError } from "@/lib/content/published/errors";

/** The render failure of one body, which names the content and the stage and nothing else. */
const renderFailure = (artifact: SignedContentArtifact) =>
  new ContentExecutionError({
    contentKey: artifact.payload.contentKey,
    stage: "render",
  });

/**
 * Reports the cause of one failed body, then fails with its render error. The
 * error names only the content and the stage, so the cause reaches the report.
 */
const failBody = Effect.fn("NakafaContent.failBody")(function* (
  artifact: SignedContentArtifact,
  cause: unknown
) {
  yield* captureServerExceptionSafely(cause, { source: "content.body" });
  return yield* renderFailure(artifact);
});

/** A render that rejected, kept with its cause until the reader reports it. */
class BodyRenderError extends Schema.TaggedError<BodyRenderError>()(
  "BodyRenderError",
  { cause: Schema.Unknown }
) {}

/**
 * Reads the body of one signed artifact as a server component tree. Its text,
 * math and frames are server markup, and each interactive visual is a client
 * reference that its own boundary loads, so the body ships no JavaScript it does
 * not run. A missing implementation fails as the renderer's own error, and a
 * render that rejects is reported with its cause and becomes one execution error.
 */
export const readRenderedBody = Effect.fn("NakafaContent.readRenderedBody")(
  function* (artifact: SignedContentArtifact) {
    const rendered = yield* renderVerifiedArtifact({ artifact });
    return yield* Effect.tryPromise({
      try: () => renderServerComponent(rendered.element),
      catch: (cause) => new BodyRenderError({ cause }),
    }).pipe(Effect.catch((error) => failBody(artifact, error.cause)));
  }
);
