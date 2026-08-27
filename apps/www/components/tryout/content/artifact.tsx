import "server-only";

import type { StoredProtectedRuntimeItem } from "@nakafa/aksara-contracts/history/decode";
import type { ProtectedContentRuntimeItem as PredecessorRuntimeItem } from "@nakafa/aksara-contracts/runtime/predecessor/spec";
import type { ProtectedContentRuntimeItem } from "@nakafa/aksara-contracts/runtime/protected/spec";
import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import { Effect } from "effect";
import type { ComponentType } from "react";
import type {
  CurrentTryoutSelector,
  HistoryTryoutSelector,
  PredecessorTryoutSelector,
  RenderedTryoutContentEntry,
  TryoutRenderSelector,
} from "@/components/tryout/content/model";
import {
  evaluateVerifiedArtifact,
  evaluateVerifiedHistoricalArtifact,
} from "@/lib/content/published/artifact";

/** Renders one live item only after its exchange was verified. */
export const renderLiveItem = Effect.fn("NakafaContent.renderLiveTryoutItem")(
  function* (
    item: PredecessorRuntimeItem | ProtectedContentRuntimeItem | undefined,
    selector: CurrentTryoutSelector | PredecessorTryoutSelector
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

/** Renders one retained item only after its exchange was verified. */
export const renderHistoryItem = Effect.fn(
  "NakafaContent.renderHistoryTryoutItem"
)(function* (
  item: StoredProtectedRuntimeItem | undefined,
  selector: HistoryTryoutSelector
) {
  if (!item) {
    return yield* new ContentRuntimeVerificationError({
      cause: "Protected content batch lost an ordered item.",
    });
  }
  const rendered = yield* evaluateVerifiedHistoricalArtifact({
    artifact: item.artifact,
  });
  return projectRenderedArtifact(rendered, selector);
});

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
