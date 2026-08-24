import "server-only";

import type { StoredProtectedRuntimeItem } from "@nakafa/aksara-contracts/history/decode";
import type { ProtectedContentRuntimeItem } from "@nakafa/aksara-contracts/runtime/protected/spec";
import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import { readRetainedProtectedContent } from "@repo/backend/client/content/history";
import { readProtectedContent } from "@repo/backend/client/content/protected";
import { contentRuntimeKeys } from "@repo/next-config/keys";
import { Effect } from "effect";
import type { ComponentType } from "react";
import {
  planTryoutContentBatches,
  restoreTryoutContentOrder,
  type TryoutContentBatchPlan,
} from "@/components/tryout/content/batch";
import {
  type CurrentContentAccess,
  type CurrentTryoutSelector,
  type HistoryContentAccess,
  type HistoryTryoutSelector,
  projectTryoutRuntimeContent,
  type RenderedTryoutContentEntry,
  type SignedContentAccess,
  type TryoutQuestionSelector,
  type TryoutRenderSelector,
} from "@/components/tryout/content/model";
import {
  makeCurrentTryoutRuntimeRequest,
  makeHistoryTryoutRuntimeRequest,
  requireCurrentTryoutQuestion,
} from "@/components/tryout/content/request";
import { env } from "@/env";
import { applyPublishedContentBatchCache } from "@/lib/content/cache";
import {
  evaluateVerifiedArtifact,
  evaluateVerifiedHistoricalArtifact,
} from "@/lib/content/published/artifact";
import { ContentRuntimeConfigurationError } from "@/lib/content/published/errors";
import { rendererManifest } from "@/lib/content/renderer/manifest";

const SIGNED_RENDER_CONCURRENCY = 4;

/** Dispatches one attempt-owned signed access at the sole runtime boundary. */
export const loadSignedTryoutContent = Effect.fn(
  "NakafaContent.loadSignedTryout"
)(function* (access: SignedContentAccess) {
  if (access.runtime === "history") {
    return yield* loadHistoryTryoutContent(access);
  }
  return yield* loadCurrentTryoutContent(access);
});

/** Renders the public featured question only through the current transport. */
export const loadCurrentTryoutQuestion = Effect.fn(
  "NakafaContent.loadCurrentTryoutQuestion"
)(function* (question: TryoutQuestionSelector) {
  const currentQuestion = yield* requireCurrentTryoutQuestion(question);
  const rendered = yield* loadCurrentTryoutContent({
    answers: [],
    questions: [currentQuestion],
  });
  const result = rendered.questions[0];
  if (!result) {
    return yield* runtimeIntegrity(
      "The featured try-out question did not render."
    );
  }
  return result;
});

/** Renders one current signed access through current-only request bytes. */
const loadCurrentTryoutContent = Effect.fn(
  "NakafaContent.loadCurrentTryoutContent"
)(function* (access: Pick<CurrentContentAccess, "answers" | "questions">) {
  const plan = planTryoutContentBatches(access.questions, access.answers);
  return yield* renderContentPlan(plan, renderCurrentBatch);
});

/** Renders one retained attempt through its isolated historical transport. */
const loadHistoryTryoutContent = Effect.fn(
  "NakafaContent.loadHistoryTryoutContent"
)(function* (access: HistoryContentAccess) {
  const plan = planTryoutContentBatches(access.questions, access.answers);
  return yield* renderContentPlan(plan, (selectors) =>
    renderHistoryBatch(access.attemptId, selectors)
  );
});

/** Executes a bounded plan and restores its question and answer partitions. */
const renderContentPlan = Effect.fn("NakafaContent.renderTryoutContentPlan")(
  function* <Selector>(
    plan: TryoutContentBatchPlan<Selector>,
    renderBatch: (
      selectors: readonly Selector[]
    ) => Promise<readonly RenderedTryoutContentEntry[]>
  ) {
    if (plan.selectorCount === 0) {
      return yield* runtimeIntegrity("Protected content batch is empty.");
    }
    const renderedBatches = yield* Effect.forEach(
      plan.batches,
      (batch) =>
        Effect.tryPromise({
          catch: (cause) => new ContentRuntimeVerificationError({ cause }),
          try: () => renderBatch(batch),
        }),
      { concurrency: SIGNED_RENDER_CONCURRENCY }
    );
    const ordered = yield* restoreTryoutContentOrder(
      plan,
      renderedBatches
    ).pipe(
      Effect.mapError((cause) => new ContentRuntimeVerificationError({ cause }))
    );
    return projectTryoutRuntimeContent(ordered);
  }
);

/** Caches one current verified batch by immutable selector identity. */
async function renderCurrentBatch(selectors: readonly CurrentTryoutSelector[]) {
  "use cache";

  const content = await Effect.runPromise(readCurrentBatch(selectors));
  cacheRenderedBatch(content);
  return content;
}

/** Caches one attempt-bound historical batch by immutable selector identity. */
async function renderHistoryBatch(
  attemptId: string,
  selectors: readonly HistoryTryoutSelector[]
) {
  "use cache";

  const content = await Effect.runPromise(
    readHistoryBatch(attemptId, selectors)
  );
  cacheRenderedBatch(content);
  return content;
}

/** Applies artifact-addressed invalidation after full exchange verification. */
function cacheRenderedBatch(content: readonly RenderedTryoutContentEntry[]) {
  applyPublishedContentBatchCache(
    "question",
    content.map(({ artifactHash }) => artifactHash)
  );
}

/** Reads, verifies, and renders one current protected batch. */
const readCurrentBatch = Effect.fn("NakafaContent.readCurrentTryoutBatch")(
  function* (selectors: readonly CurrentTryoutSelector[]) {
    const request = yield* makeCurrentTryoutRuntimeRequest(selectors);
    const target = yield* readRuntimeTarget;
    const liveRenderer = yield* rendererManifest;
    const found = yield* readProtectedContent(target, request, liveRenderer);
    return yield* Effect.forEach(
      selectors.map((selector, index) => ({
        item: found.items[index],
        selector,
      })),
      ({ item, selector }) => renderCurrentItem(item, selector),
      { concurrency: SIGNED_RENDER_CONCURRENCY }
    );
  }
);

/** Reads, verifies, and renders one attempt-bound historical batch. */
const readHistoryBatch = Effect.fn("NakafaContent.readHistoryTryoutBatch")(
  function* (attemptId: string, selectors: readonly HistoryTryoutSelector[]) {
    const request = yield* makeHistoryTryoutRuntimeRequest(
      attemptId,
      selectors
    );
    const target = yield* readRuntimeTarget;
    const liveRenderer = yield* rendererManifest;
    const found = yield* readRetainedProtectedContent(
      target,
      request,
      liveRenderer
    );
    return yield* Effect.forEach(
      selectors.map((selector, index) => ({
        item: found.items[index],
        selector,
      })),
      ({ item, selector }) => renderHistoryItem(item, selector),
      { concurrency: SIGNED_RENDER_CONCURRENCY }
    );
  }
);

/** Reads the server-owned protected runtime target. */
const readRuntimeTarget = Effect.try({
  catch: () =>
    new ContentRuntimeConfigurationError({ key: "CONTENT_RUNTIME_TOKEN" }),
  try: () => ({
    siteUrl: env.NEXT_PUBLIC_CONVEX_SITE_URL,
    token: contentRuntimeKeys().CONTENT_RUNTIME_TOKEN,
  }),
});

/** Renders one current item only after current exchange verification. */
const renderCurrentItem = Effect.fn("NakafaContent.renderCurrentTryoutItem")(
  function* (
    item: ProtectedContentRuntimeItem | undefined,
    selector: CurrentTryoutSelector
  ) {
    if (!item) {
      return yield* runtimeIntegrity(
        "Protected content batch lost an ordered item."
      );
    }
    const rendered = yield* evaluateVerifiedArtifact({
      artifact: item.artifact,
    });
    return projectRenderedArtifact(rendered, selector);
  }
);

/** Renders one old item only after historical exchange verification. */
const renderHistoryItem = Effect.fn("NakafaContent.renderHistoryTryoutItem")(
  function* (
    item: StoredProtectedRuntimeItem | undefined,
    selector: HistoryTryoutSelector
  ) {
    if (!item) {
      return yield* runtimeIntegrity(
        "Protected content batch lost an ordered item."
      );
    }
    const rendered = yield* evaluateVerifiedHistoricalArtifact({
      artifact: item.artifact,
    });
    return projectRenderedArtifact(rendered, selector);
  }
);

/** Projects one separately typed authenticated artifact into runtime content. */
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

/** Creates one consistent signed runtime verification failure. */
function runtimeIntegrity(cause: string) {
  return new ContentRuntimeVerificationError({ cause });
}
