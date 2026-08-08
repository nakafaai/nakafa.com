import "server-only";

import { MAX_PROTECTED_RUNTIME_SELECTORS } from "@nakafa/aksara-contracts/runtime/protected/limits";
import type { ProtectedContentRuntimeItem } from "@nakafa/aksara-contracts/runtime/protected/spec";
import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import { readProtectedContent } from "@repo/backend/client/content/protected";
import { contentRuntimeKeys } from "@repo/next-config/keys";
import { Effect } from "effect";
import type {
  TryoutAnswerContent,
  TryoutAnswerSelector,
  TryoutQuestionContent,
  TryoutQuestionSelector,
} from "@/components/tryout/content/model";
import { env } from "@/env";
import { applyPublishedContentBatchCache } from "@/lib/content/cache";
import { evaluateVerifiedArtifact } from "@/lib/content/published/artifact";
import { ContentRuntimeConfigurationError } from "@/lib/content/published/errors";
import { getRendererComponents } from "@/lib/content/renderer/components";
import { rendererManifest } from "@/lib/content/renderer/manifest";

type ProtectedSelector = TryoutAnswerSelector | TryoutQuestionSelector;
const SIGNED_RENDER_CONCURRENCY = 4;

/** Renders protected questions and answers through bounded signed batches. */
export const loadSignedTryoutContent = Effect.fn(
  "NakafaContent.loadSignedTryout"
)(function* (input: {
  readonly answers: readonly TryoutAnswerSelector[];
  readonly questions: readonly TryoutQuestionSelector[];
}) {
  const selectors = [...input.questions, ...input.answers];
  if (selectors.length === 0) {
    return yield* new ContentRuntimeVerificationError({
      cause: "Protected content batch is empty.",
    });
  }
  const chunks = chunkSelectors(selectors);
  const batches = yield* Effect.forEach(
    chunks,
    (chunk) =>
      Effect.tryPromise({
        catch: (cause) => new ContentRuntimeVerificationError({ cause }),
        try: () => renderSignedBatch(chunk),
      }),
    { concurrency: SIGNED_RENDER_CONCURRENCY }
  );
  const entries = batches.flat();
  const questionEntries = entries.slice(0, input.questions.length);
  const answerEntries = entries.slice(input.questions.length);
  const questions = questionEntries.map(
    ({ body, contentHash, sourcePath, sourceRevision }) =>
      ({
        content: body,
        contentHash,
        sourcePath,
        sourceRevision,
      }) satisfies TryoutQuestionContent
  );
  const answers = answerEntries.map(
    ({ body, contentHash, sourcePath, sourceRevision }) =>
      ({
        answer: body,
        contentHash,
        sourcePath,
        sourceRevision,
      }) satisfies TryoutAnswerContent
  );
  return { answers, questions };
});

/** Splits a section only when its signed selector count exceeds the contract. */
function chunkSelectors(selectors: readonly ProtectedSelector[]) {
  const chunks: ProtectedSelector[][] = [];
  for (
    let start = 0;
    start < selectors.length;
    start += MAX_PROTECTED_RUNTIME_SELECTORS
  ) {
    chunks.push(
      selectors.slice(start, start + MAX_PROTECTED_RUNTIME_SELECTORS)
    );
  }
  return chunks;
}

/** Caches one verified batch under every immutable artifact identity it owns. */
async function renderSignedBatch(selectors: readonly ProtectedSelector[]) {
  "use cache";

  const content = await Effect.runPromise(readSignedBatch(selectors));
  applyPublishedContentBatchCache(
    "question",
    content.map(({ artifactHash }) => artifactHash)
  );
  return content;
}

/** Reads, verifies, and executes one retained-snapshot protected batch. */
const readSignedBatch = Effect.fn("NakafaContent.readSignedTryoutBatch")(
  function* (selectors: readonly ProtectedSelector[]) {
    const request = yield* makeProtectedRequest(selectors);
    const runtimeKeys = yield* Effect.try({
      catch: () =>
        new ContentRuntimeConfigurationError({
          key: "CONTENT_RUNTIME_TOKEN",
        }),
      try: contentRuntimeKeys,
    });
    const liveRenderer = yield* rendererManifest;
    const found = yield* readProtectedContent(
      {
        siteUrl: env.NEXT_PUBLIC_CONVEX_SITE_URL,
        token: runtimeKeys.CONTENT_RUNTIME_TOKEN,
      },
      request,
      liveRenderer
    );
    return yield* Effect.forEach(
      selectors.map((selector, index) => ({
        item: found.items[index],
        selector,
      })),
      ({ item, selector }) => renderSignedItem(item, selector),
      { concurrency: SIGNED_RENDER_CONCURRENCY }
    );
  }
);

/** Builds one contract request while preserving shared snapshot identity. */
const makeProtectedRequest = Effect.fn("NakafaContent.makeProtectedRequest")(
  function* (selectors: readonly ProtectedSelector[]) {
    const first = selectors[0];
    if (!first) {
      return yield* new ContentRuntimeVerificationError({
        cause: "Protected content batch is empty.",
      });
    }
    const coherent = selectors.every(
      (selector) =>
        selector.locale === first.locale &&
        selector.snapshotId === first.snapshotId &&
        selector.snapshotReleaseId === first.snapshotReleaseId
    );
    if (!coherent) {
      return yield* new ContentRuntimeVerificationError({
        cause: "Protected content batch spans multiple snapshots.",
      });
    }
    return {
      locale: first.locale,
      selectors: selectors.map(({ artifactHash, contentKey, delivery }) => ({
        artifactHash,
        contentKey,
        delivery,
      })),
      snapshotId: first.snapshotId,
      snapshotReleaseId: first.snapshotReleaseId,
    };
  }
);

/** Executes one signed item already verified by the protected exchange. */
const renderSignedItem = Effect.fn("NakafaContent.renderSignedTryoutItem")(
  function* (
    item: ProtectedContentRuntimeItem | undefined,
    selector: ProtectedSelector
  ) {
    if (!item) {
      return yield* new ContentRuntimeVerificationError({
        cause: "Protected content batch lost an ordered item.",
      });
    }
    const components = getRendererComponents(
      item.artifact.payload.rendererDomain
    );
    const rendered = yield* evaluateVerifiedArtifact({
      artifact: item.artifact,
      components,
    });
    return {
      artifactHash: rendered.artifact.artifactHash,
      body: <rendered.Content />,
      contentHash: selector.contentHash,
      sourcePath: selector.sourcePath,
      sourceRevision: selector.sourceRevision,
    };
  }
);
