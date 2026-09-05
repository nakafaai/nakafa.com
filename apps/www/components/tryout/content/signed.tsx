import "server-only";

import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { verifyAttemptContent } from "@repo/backend/client/content/attempt";
import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import { readProtectedContent } from "@repo/backend/client/content/protected";
import { contentKeyResolver } from "@repo/backend/content/trust";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { TryoutBodyBatch } from "@repo/backend/convex/tryouts/runtime/body";
import type { TryoutHistoryRequest } from "@repo/backend/convex/tryouts/runtime/history/spec";
import { contentRuntimeKeys } from "@repo/next-config/keys";
import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";
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
import { getToken } from "@/lib/auth/server";
import { applyPublishedContentBatchCache } from "@/lib/content/cache";
import { ContentRuntimeConfigurationError } from "@/lib/content/published/errors";
import { rendererManifest } from "@/lib/content/renderer/manifest";

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
    return yield* runtimeIntegrity(
      "Try-out content requires an active session."
    );
  }
  const plan = planTryoutContentBatches(access.questions, access.answers);
  return yield* renderContentPlan(plan, (selectors) =>
    readAttemptBatch(attemptId, token, selectors)
  );
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
    return yield* renderContentPlan(plan, (selectors) =>
      Effect.tryPromise({
        catch: (cause) => new ContentRuntimeVerificationError({ cause }),
        try: () => renderBatch(selectors),
      })
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
      return yield* runtimeIntegrity("Protected content batch is empty.");
    }
    const renderedBatches = yield* Effect.forEach(plan.batches, renderBatch, {
      concurrency: SIGNED_RENDER_CONCURRENCY,
    });
    const ordered = yield* restoreTryoutContentOrder(
      plan,
      renderedBatches
    ).pipe(
      Effect.mapError((cause) => new ContentRuntimeVerificationError({ cause }))
    );
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
  cacheRenderedBatch(content);
  return content;
}

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
  return yield* renderFoundItems(selectors, found.items);
});

/** Renders only the ordered items accepted by signed exchange verification. */
const renderFoundItems = Effect.fn("NakafaContent.renderFoundItems")(function* (
  selectors: readonly TryoutSelector[],
  items: Effect.Success<ReturnType<typeof verifyAttemptContent>>["items"]
) {
  return yield* Effect.forEach(
    selectors.map((selector, index) => ({
      item: items[index],
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
