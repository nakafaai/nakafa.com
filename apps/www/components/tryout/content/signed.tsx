import "server-only";

import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import { readProtectedContent } from "@repo/backend/client/content/protected";
import { contentRuntimeKeys } from "@repo/next-config/keys";
import { Effect } from "effect";
import { renderLiveItem } from "@/components/tryout/content/artifact";
import {
  planTryoutContentBatches,
  restoreTryoutContentOrder,
  type TryoutContentBatchPlan,
} from "@/components/tryout/content/batch";
import {
  projectTryoutRuntimeContent,
  type RenderedTryoutContentEntry,
  type SignedContentAccess,
  type TryoutQuestionSelector,
  type TryoutSelector,
} from "@/components/tryout/content/model";
import { makeTryoutRuntimeRequest } from "@/components/tryout/content/request";
import { env } from "@/env";
import { applyPublishedContentBatchCache } from "@/lib/content/cache";
import { ContentRuntimeConfigurationError } from "@/lib/content/published/errors";
import { rendererManifest } from "@/lib/content/renderer/manifest";

const SIGNED_RENDER_CONCURRENCY = 4;

/** Dispatches one attempt-owned signed access at the sole runtime boundary. */
export const loadSignedTryoutContent = Effect.fn(
  "NakafaContent.loadSignedTryout"
)(function* (access: SignedContentAccess) {
  return yield* loadTryoutContent(access);
});

/** Renders the public featured question through its exact live transport. */
export const loadTryoutQuestion = Effect.fn("NakafaContent.loadTryoutQuestion")(
  function* (question: TryoutQuestionSelector) {
    const rendered = yield* loadTryoutContent({
      answers: [],
      kind: "signed",
      questions: [question],
    });
    const result = rendered.questions[0];
    if (!result) {
      return yield* runtimeIntegrity(
        "The featured try-out question did not render."
      );
    }
    return result;
  }
);

/** Renders one signed access through permanent runtime bytes. */
const loadTryoutContent = Effect.fn("NakafaContent.loadTryoutContent")(
  function* (access: SignedContentAccess) {
    const plan = planTryoutContentBatches(access.questions, access.answers);
    return yield* renderContentPlan(plan, renderBatch);
  }
);

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

/** Caches one verified batch by immutable selector identity. */
async function renderBatch(selectors: readonly TryoutSelector[]) {
  "use cache";

  const content = await Effect.runPromise(readBatch(selectors));
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

/** Reads, verifies, and renders one protected batch. */
const readBatch = Effect.fn("NakafaContent.readTryoutBatch")(function* (
  selectors: readonly TryoutSelector[]
) {
  const request = yield* makeTryoutRuntimeRequest(selectors);
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
});

/** Reads the server-owned protected runtime target. */
const readRuntimeTarget = Effect.try({
  catch: () =>
    new ContentRuntimeConfigurationError({ key: "CONTENT_RUNTIME_TOKEN" }),
  try: () => ({
    siteUrl: env.CONTENT_BUILD_SITE_URL ?? env.NEXT_PUBLIC_CONVEX_SITE_URL,
    token: contentRuntimeKeys().CONTENT_RUNTIME_TOKEN,
  }),
});

/** Creates one consistent signed runtime verification failure. */
function runtimeIntegrity(cause: string) {
  return new ContentRuntimeVerificationError({ cause });
}
