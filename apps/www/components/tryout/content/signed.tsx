import "server-only";

import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import { readRetainedProtectedContent } from "@repo/backend/client/content/history";
import { readPredecessorContent } from "@repo/backend/client/content/predecessor";
import { readProtectedContent } from "@repo/backend/client/content/protected";
import { contentRuntimeKeys } from "@repo/next-config/keys";
import { Effect } from "effect";
import {
  renderHistoryItem,
  renderLiveItem,
} from "@/components/tryout/content/artifact";
import {
  planTryoutContentBatches,
  restoreTryoutContentOrder,
  type TryoutContentBatchPlan,
} from "@/components/tryout/content/batch";
import {
  type CurrentContentAccess,
  type CurrentTryoutQuestionSelector,
  type CurrentTryoutSelector,
  type HistoryContentAccess,
  type HistoryTryoutSelector,
  type PredecessorContentAccess,
  type PredecessorTryoutQuestionSelector,
  type PredecessorTryoutSelector,
  projectTryoutRuntimeContent,
  type RenderedTryoutContentEntry,
  type SignedContentAccess,
  type TryoutQuestionSelector,
} from "@/components/tryout/content/model";
import {
  makeCurrentTryoutRuntimeRequest,
  makeHistoryTryoutRuntimeRequest,
  makePredecessorTryoutRuntimeRequest,
  requireLiveTryoutQuestion,
} from "@/components/tryout/content/request";
import { env } from "@/env";
import { applyPublishedContentBatchCache } from "@/lib/content/cache";
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
  if (access.runtime === "predecessor") {
    return yield* loadPredecessorTryoutContent(access);
  }
  return yield* loadCurrentTryoutContent(access);
});

/** Renders the public featured question through its exact live transport. */
export const loadCurrentTryoutQuestion = Effect.fn(
  "NakafaContent.loadCurrentTryoutQuestion"
)(function* (question: TryoutQuestionSelector) {
  const liveQuestion = yield* requireLiveTryoutQuestion(question);
  const rendered = yield* hasPermanentBundle(liveQuestion)
    ? loadCurrentTryoutContent({ answers: [], questions: [liveQuestion] })
    : loadPredecessorTryoutContent({
        answers: [],
        questions: [liveQuestion],
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

/** Renders one predecessor access through its isolated temporary transport. */
const loadPredecessorTryoutContent = Effect.fn(
  "NakafaContent.loadPredecessorTryoutContent"
)(function* (access: Pick<PredecessorContentAccess, "answers" | "questions">) {
  const plan = planTryoutContentBatches(access.questions, access.answers);
  return yield* renderContentPlan(plan, renderPredecessorBatch);
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

/** Renders one predecessor batch through its instrumented transport. */
function renderPredecessorBatch(
  selectors: readonly PredecessorTryoutSelector[]
) {
  return Effect.runPromise(readPredecessorBatch(selectors));
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
      ({ item, selector }) => renderLiveItem(item, selector),
      { concurrency: SIGNED_RENDER_CONCURRENCY }
    );
  }
);

/** Reads, verifies, and renders one predecessor protected batch. */
const readPredecessorBatch = Effect.fn(
  "NakafaContent.readPredecessorTryoutBatch"
)(function* (selectors: readonly PredecessorTryoutSelector[]) {
  const request = yield* makePredecessorTryoutRuntimeRequest(selectors);
  const target = yield* readRuntimeTarget;
  const liveRenderer = yield* rendererManifest;
  const found = yield* readPredecessorContent(target, request, liveRenderer);
  return yield* Effect.forEach(
    selectors.map((selector, index) => ({
      item: found.items[index],
      selector,
    })),
    ({ item, selector }) => renderLiveItem(item, selector),
    { concurrency: SIGNED_RENDER_CONCURRENCY }
  );
});

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

/** Creates one consistent signed runtime verification failure. */
function runtimeIntegrity(cause: string) {
  return new ContentRuntimeVerificationError({ cause });
}

/** Narrows one live selector to the permanent runtime generation. */
function hasPermanentBundle(
  question: CurrentTryoutQuestionSelector | PredecessorTryoutQuestionSelector
): question is CurrentTryoutQuestionSelector {
  return "bundleHash" in question && typeof question.bundleHash === "string";
}
