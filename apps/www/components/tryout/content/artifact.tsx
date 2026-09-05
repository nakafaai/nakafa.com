import "server-only";

import type { ProtectedContentRuntimeItem } from "@nakafa/aksara-contracts/runtime/protected/spec";
import { Effect } from "effect";
import type {
  RenderedTryoutContentEntry,
  TryoutSelector,
} from "@/components/tryout/content/model";
import { evaluateVerifiedArtifact } from "@/lib/content/published/artifact";

/** Renders one live item only after its exchange was verified. */
export const renderLiveItem = Effect.fn("NakafaContent.renderLiveTryoutItem")(
  function* (item: ProtectedContentRuntimeItem, selector: TryoutSelector) {
    const rendered = yield* evaluateVerifiedArtifact({
      artifact: item.artifact,
    });
    return {
      artifactHash: rendered.artifact.artifactHash,
      body: <rendered.Content />,
      contentHash: selector.contentHash,
      sourcePath: selector.sourcePath,
      sourceRevision: selector.sourceRevision,
    } satisfies RenderedTryoutContentEntry;
  }
);
