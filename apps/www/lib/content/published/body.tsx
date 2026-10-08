import "server-only";
import { makeArtifactCacheTag } from "@nakafa/aksara-contracts/cache/content";
import type { SignedContentArtifact } from "@nakafa/aksara-contracts/content";

import { Effect } from "effect";
import { cacheLife, cacheTag } from "next/cache";
import { evaluateVerifiedArtifact } from "@/lib/content/published/artifact";
import { ContentExecutionError } from "@/lib/content/published/errors";

/** Caches JSX by the full signed artifact and Next's build identity. */
async function renderVerifiedBody(artifact: SignedContentArtifact) {
  "use cache";

  cacheLife("max");
  cacheTag(makeArtifactCacheTag(artifact.artifactHash));
  const rendered = await Effect.runPromise(
    evaluateVerifiedArtifact({ artifact })
  );
  return <rendered.Content />;
}

/**
 * Reads the cached body. Next.js replaces an error thrown inside a cached
 * function with a digest before the caller sees it, and reports the original
 * error where it was thrown, so every failure arrives here without its class
 * and becomes the one content execution error.
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
