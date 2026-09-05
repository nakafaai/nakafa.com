import "server-only";

import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { verifyAttemptContent } from "@repo/backend/client/content/attempt";
import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import {
  readProtectedContent,
  readSnapshotProtectedContent,
} from "@repo/backend/client/content/protected";
import { contentKeyResolver } from "@repo/backend/content/trust";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { TryoutBodyBatch } from "@repo/backend/convex/tryouts/runtime/body";
import type { TryoutHistoryRequest } from "@repo/backend/convex/tryouts/runtime/history/spec";
import { contentRuntimeKeys } from "@repo/next-config/keys";
import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";
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
import { getToken } from "@/lib/auth/server";
import { applyPublishedContentBatchCache } from "@/lib/content/cache";
import { ContentRuntimeConfigurationError } from "@/lib/content/published/errors";
import { rendererManifest } from "@/lib/content/renderer/manifest";
import { loadContentSnapshot } from "@/lib/content/runtime/snapshot";

const SIGNED_RENDER_CONCURRENCY = 4;
const attemptContentQuery = makeFunctionReference<
  "query",
  TryoutHistoryRequest,
  TryoutBodyBatch | null
>("tryouts/queries/content:getBatch");

/** Dispatches one attempt-owned signed access at the sole runtime boundary. */
export const loadSignedTryoutContent = Effect.fn(
  "NakafaContent.loadSignedTryout"
)(function* (attemptId: Id<"tryoutAttempts">, access: SignedContentAccess) {
  const token = yield* Effect.tryPromise({
    catch: (cause) => new ContentRuntimeVerificationError({ cause }),
    try: () => getToken(),
  });
  if (!token) {
    return yield* new ContentRuntimeVerificationError({
      cause: "Try-out content requires an active session.",
    });
  }
  const plan = planTryoutContentBatches(access.questions, access.answers);
  return yield* renderContentPlan(plan, (selectors) =>
    readAttemptBatch(attemptId, token, selectors)
  );
});

/** Renders the public featured question through its exact signed source. */
export const loadTryoutQuestion = Effect.fn("NakafaContent.loadTryoutQuestion")(
  function* (question: TryoutQuestionSelector) {
    const plan = planTryoutContentBatches([question], []);
    const rendered = yield* renderContentPlan(plan, (selectors) =>
      Effect.tryPromise({
        catch: (cause) => new ContentRuntimeVerificationError({ cause }),
        try: () => renderBatch(selectors),
      })
    );
    // Successful ordered rendering preserves this one-question partition.
    return yield* Effect.fromNullishOr(rendered.questions[0]).pipe(
      Effect.orDie
    );
  }
);

/** Executes a bounded plan and restores its question and answer partitions. */
const renderContentPlan = Effect.fn("NakafaContent.renderTryoutContentPlan")(
  function* <Selector, Error>(
    plan: TryoutContentBatchPlan<Selector>,
    renderBatch: (
      selectors: readonly Selector[]
    ) => Effect.Effect<readonly RenderedTryoutContentEntry[], Error>
  ) {
    if (plan.selectorCount === 0) {
      return yield* new ContentRuntimeVerificationError({
        cause: "Protected content batch is empty.",
      });
    }
    const renderedBatches = yield* Effect.forEach(plan.batches, renderBatch, {
      concurrency: SIGNED_RENDER_CONCURRENCY,
    });
    // The private renderer either fails or returns one entry per selector.
    const ordered = yield* restoreTryoutContentOrder(
      plan,
      renderedBatches
    ).pipe(Effect.orDie);
    return projectTryoutRuntimeContent(ordered);
  }
);

/** Rechecks session and attempt entitlement before entering any shared cache. */
const readAttemptBatch = Effect.fn("NakafaContent.readAttemptBatch")(function* (
  attemptId: Id<"tryoutAttempts">,
  token: string,
  selectors: readonly TryoutSelector[]
) {
  const row = yield* Effect.tryPromise({
    catch: (cause) => new ContentRuntimeVerificationError({ cause }),
    try: () =>
      fetchQuery(
        attemptContentQuery,
        { attemptId, selectors: [...selectors] },
        { token }
      ),
  });
  return yield* Effect.tryPromise({
    catch: (cause) => new ContentRuntimeVerificationError({ cause }),
    try: () => renderAttemptBatch(selectors, row),
  });
});

/** Caches verified immutable bytes after fresh authorization, without session data. */
async function renderAttemptBatch(
  selectors: readonly TryoutSelector[],
  row: TryoutBodyBatch | null
) {
  "use cache";

  const content = await Effect.runPromise(
    Effect.gen(function* () {
      const request = yield* makeTryoutRuntimeRequest(selectors);
      const liveRenderer = yield* rendererManifest;
      const found = yield* verifyAttemptContent(
        request,
        row,
        liveRenderer
      ).pipe(
        Effect.provideService(
          ContentVerificationKeyResolver,
          contentKeyResolver
        )
      );
      return yield* renderFoundItems(selectors, found.items);
    })
  );
  applyPublishedContentBatchCache(
    "question",
    content.map(({ artifactHash }) => artifactHash)
  );
  return content;
}

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
  return yield* renderFoundItems(selectors, found.items);
});

/** Renders only the ordered items accepted by signed exchange verification. */
const renderFoundItems = Effect.fn("NakafaContent.renderFoundItems")(function* (
  selectors: readonly TryoutSelector[],
  items: Effect.Success<ReturnType<typeof verifyAttemptContent>>["items"]
) {
  return yield* Effect.forEach(
    // Exchange verification already checks equal counts and ordered identities.
    Arr.zip(selectors, items),
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
