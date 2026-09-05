import "server-only";

import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import {
  readProtectedContent,
  readSnapshotProtectedContent,
} from "@repo/backend/client/content/protected";
import { contentRuntimeKeys } from "@repo/next-config/keys";
import { Array as Arr, Effect } from "effect";
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
import { loadContentSnapshot } from "@/lib/content/runtime/snapshot";

const SIGNED_RENDER_CONCURRENCY = 4;

/** Dispatches one attempt-owned signed access at the sole runtime boundary. */
export const loadSignedTryoutContent = Effect.fn(
  "NakafaContent.loadSignedTryout"
)(function* (access: SignedContentAccess) {
  const plan = planTryoutContentBatches(access.questions, access.answers);
  return yield* renderContentPlan(plan, renderBatch);
});

/** Renders the public featured question through its exact live transport. */
export const loadTryoutQuestion = Effect.fn("NakafaContent.loadTryoutQuestion")(
  function* (question: TryoutQuestionSelector) {
    const rendered = yield* loadSignedTryoutContent({
      answers: [],
      kind: "signed",
      questions: [question],
    });
    // Successful ordered rendering preserves this one-question partition.
    return yield* Effect.fromNullishOr(rendered.questions[0]).pipe(
      Effect.orDie
    );
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
      return yield* new ContentRuntimeVerificationError({
        cause: "Protected content batch is empty.",
      });
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
    // The private renderer either fails or returns one entry per selector.
    const ordered = yield* restoreTryoutContentOrder(
      plan,
      renderedBatches
    ).pipe(Effect.orDie);
    return projectTryoutRuntimeContent(ordered);
  }
);

/** Caches one verified batch by immutable selector identity. */
async function renderBatch(selectors: readonly TryoutSelector[]) {
  "use cache";

  await loadContentSnapshot();
  const content = await Effect.runPromise(readBatch(selectors));
  applyPublishedContentBatchCache(
    "question",
    content.map(({ artifactHash }) => artifactHash)
  );
  return content;
}

/** Reads, verifies, and renders one protected batch. */
const readBatch = Effect.fn("NakafaContent.readTryoutBatch")(function* (
  selectors: readonly TryoutSelector[]
) {
  const request = yield* makeTryoutRuntimeRequest(selectors);
  const liveRenderer = yield* rendererManifest;
  const snapshot = yield* Effect.tryPromise(() => loadContentSnapshot());
  const found =
    snapshot === undefined
      ? yield* readProtectedContent(
          yield* readRuntimeTarget,
          request,
          liveRenderer
        )
      : yield* readSnapshotProtectedContent(request, liveRenderer).pipe(
          Effect.provideContext(snapshot)
        );
  return yield* Effect.forEach(
    // The protected exchange verifies equal counts and ordered identities.
    Arr.zip(selectors, found.items),
    ([selector, item]) => renderLiveItem(item, selector),
    { concurrency: SIGNED_RENDER_CONCURRENCY }
  );
});

/** Reads the server-owned protected runtime target. */
const readRuntimeTarget = Effect.try({
  catch: () =>
    new ContentRuntimeConfigurationError({ key: "CONTENT_RUNTIME_TOKEN" }),
  try: () => ({
    siteUrl: env.NEXT_PUBLIC_CONVEX_SITE_URL,
    token: contentRuntimeKeys().CONTENT_RUNTIME_TOKEN,
  }),
});
