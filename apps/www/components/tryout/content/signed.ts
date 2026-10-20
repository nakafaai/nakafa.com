import { HttpClient } from "@confect/js";
import "@tanstack/react-start/server-only";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { verifyAttemptContent } from "@repo/backend/client/content/attempt";
import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import { readProtectedContent } from "@repo/backend/client/content/protected";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type { TryoutBodyBatch } from "@repo/backend/confect/tryouts/runtime/body";
import { contentKeyResolver } from "@repo/backend/content/trust";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { contentRuntimeKeys } from "@repo/site/keys";
import { getRequest } from "@tanstack/react-start/server";
import { Array as Arr, Effect, Option } from "effect";
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
import { readSessionMemo } from "@/lib/auth/session.server";
import { ContentRuntimeConfigurationError } from "@/lib/content/published/errors";
import { rendererManifest } from "@/lib/content/renderer/manifest";
import { httpLayer } from "@/lib/convex/http";

const SIGNED_RENDER_CONCURRENCY = 4;

/** Dispatches one attempt-owned signed access at the sole runtime boundary. */
export const loadSignedTryoutContent = Effect.fn(
  "NakafaContent.loadSignedTryout"
)(function* (attemptId: Id<"tryoutAttempts">, access: SignedContentAccess) {
  const session = yield* Effect.flatten(readSessionMemo(getRequest()));
  const token = session.convexToken;
  if (Option.isNone(token)) {
    return yield* new ContentRuntimeVerificationError({
      cause: "Try-out content requires an active session.",
    });
  }
  const plan = planTryoutContentBatches(access.questions, access.answers);
  return yield* renderContentPlan(plan, (selectors) =>
    readAttemptBatch(attemptId, token.value, selectors)
  );
});

/** Renders the public featured question through its exact signed source. */
export const loadTryoutQuestion = Effect.fn("NakafaContent.loadTryoutQuestion")(
  function* (question: TryoutQuestionSelector) {
    const plan = planTryoutContentBatches([question], []);
    const rendered = yield* renderContentPlan(plan, (selectors) =>
      Effect.tryPromise({
        catch: (cause) =>
          new ContentRuntimeVerificationError({
            cause,
          }),
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

/** Authorizes one attempt batch on every request: getBatch checks the session and the attempt. */
const readAttemptBatch = Effect.fn("NakafaContent.readAttemptBatch")(function* (
  attemptId: Id<"tryoutAttempts">,
  token: string,
  selectors: readonly TryoutSelector[]
) {
  const row = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(tryouts.queries.content.getBatch, {
      attemptId,
      selectors: [...selectors],
    })
  ).pipe(
    Effect.provide(
      httpLayer({
        auth: token,
      })
    ),
    Effect.withTracerTiming(false),
    Effect.mapError(
      (cause) =>
        new ContentRuntimeVerificationError({
          cause,
        })
    )
  );
  return yield* Effect.tryPromise({
    catch: (cause) =>
      new ContentRuntimeVerificationError({
        cause,
      }),
    try: () => renderAttemptBatch(selectors, row),
  });
});

/**
 * Verifies and renders one attempt batch on every request. Nothing caches the
 * result, so each load verifies the signed bodies and evaluates them again.
 */
async function renderAttemptBatch(
  selectors: readonly TryoutSelector[],
  row: TryoutBodyBatch | null
) {
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
  return content;
}

/**
 * Reads, verifies and renders one public batch on every call. Nothing caches the
 * result: the rendered tree is React, which the content store cannot hold, so
 * each call reads the runtime again.
 */
async function renderBatch(selectors: readonly TryoutSelector[]) {
  const content = await Effect.runPromise(readBatch(selectors));
  return content;
}

/** Reads, verifies, and renders one protected batch. */
const readBatch = Effect.fn("NakafaContent.readTryoutBatch")(function* (
  selectors: readonly TryoutSelector[]
) {
  const request = yield* makeTryoutRuntimeRequest(selectors);
  const liveRenderer = yield* rendererManifest;
  const found = yield* readProtectedContent(
    yield* readRuntimeTarget,
    request,
    liveRenderer
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
    {
      concurrency: SIGNED_RENDER_CONCURRENCY,
    }
  );
});

/** Reads the server-owned protected runtime target. */
const readRuntimeTarget = Effect.try({
  catch: () =>
    new ContentRuntimeConfigurationError({
      key: "CONTENT_RUNTIME_TOKEN",
    }),
  try: () => ({
    siteUrl: env.VITE_CONVEX_SITE_URL,
    token: contentRuntimeKeys().CONTENT_RUNTIME_TOKEN,
  }),
});
