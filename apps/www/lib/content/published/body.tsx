import "server-only";

import type { SignedContentArtifact } from "@nakafa/aksara-contracts/content";
import { Effect } from "effect";
import { applyImmutableContentCache } from "@/lib/content/cache";
import { evaluateVerifiedArtifact } from "@/lib/content/published/artifact";
import { ContentExecutionError } from "@/lib/content/published/errors";
import {
  RendererComponentCollision,
  RendererImplementationMissing,
} from "@/lib/content/renderer/selection";

/** Caches JSX by the full signed artifact and Next's build identity. */
async function renderVerifiedBody(artifact: SignedContentArtifact) {
  "use cache";

  applyImmutableContentCache([artifact.artifactHash]);
  const rendered = await Effect.runPromise(
    evaluateVerifiedArtifact({ artifact })
  );
  return <rendered.Content />;
}

/** Preserves typed rendering failures across the Next cache boundary. */
export const readRenderedBody = Effect.fn("NakafaContent.readRenderedBody")(
  (artifact: SignedContentArtifact) =>
    Effect.tryPromise({
      try: () => renderVerifiedBody(artifact),
      catch: (cause) =>
        cause instanceof ContentExecutionError ||
        cause instanceof RendererComponentCollision ||
        cause instanceof RendererImplementationMissing
          ? cause
          : new ContentExecutionError({
              contentKey: artifact.payload.contentKey,
              stage: "evaluate",
            }),
    })
);
