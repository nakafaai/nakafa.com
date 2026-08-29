import "server-only";

import type { ProtectedContentRuntimeItem } from "@nakafa/aksara-contracts/runtime/protected/spec";
import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import { Effect } from "effect";
import type { ComponentType } from "react";
import type {
  RenderedTryoutContentEntry,
  TryoutRenderSelector,
  TryoutSelector,
} from "@/components/tryout/content/model";
import { evaluateVerifiedArtifact } from "@/lib/content/published/artifact";

/** Renders one live item only after its exchange was verified. */
export const renderLiveItem = Effect.fn("NakafaContent.renderLiveTryoutItem")(
  function* (
    item: ProtectedContentRuntimeItem | undefined,
    selector: TryoutSelector
  ) {
    if (!item) {
      return yield* new ContentRuntimeVerificationError({
        cause: "Protected content batch lost an ordered item.",
      });
    }
    const rendered = yield* evaluateVerifiedArtifact({
      artifact: item.artifact,
    });
    return projectRenderedArtifact(rendered, selector);
  }
);

/** Projects one authenticated artifact into runtime content. */
function projectRenderedArtifact(
  rendered: {
    readonly artifact: {
      readonly artifactHash: RenderedTryoutContentEntry["artifactHash"];
    };
    readonly Content: ComponentType;
  },
  selector: TryoutRenderSelector
) {
  return {
    artifactHash: rendered.artifact.artifactHash,
    body: <rendered.Content />,
    contentHash: selector.contentHash,
    sourcePath: selector.sourcePath,
    sourceRevision: selector.sourceRevision,
  } satisfies RenderedTryoutContentEntry;
}
