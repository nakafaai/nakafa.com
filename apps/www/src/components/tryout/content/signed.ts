import { HttpClient } from "@confect/js";
import "@tanstack/react-start/server-only";
import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type { TryoutBodyBatch } from "@repo/backend/confect/tryouts/runtime/body";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { contentRuntimeKeys } from "@repo/site/keys";
import { getRequest } from "@tanstack/react-start/server";
import { Array as Arr, Effect, Option, Predicate } from "effect";
import { renderLiveItem } from "@/components/tryout/content/artifact";
import {
  planTryoutContentBatches,
  restoreTryoutContentOrder,
  type TryoutContentBatchPlan,
} from "@/components/tryout/content/batch";
import { readFeaturedProtectedContent } from "@/components/tryout/content/featured";
import {
  projectTryoutRuntimeContent,
  type RenderedTryoutContentEntry,
  type SignedContentAccess,
  type TryoutQuestionSelector,
  type TryoutSelector,
} from "@/components/tryout/content/model";
import { makeTryoutRuntimeRequest } from "@/components/tryout/content/request";
import { readVerifiedAttemptBatch } from "@/components/tryout/content/verified";
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

/**
 * Verifies and renders the signed bodies that a section read already returned,
 * one row for each batch the content plans. Nothing reads Convex here, so the
 * page read is the only Convex read of a running section.
 */
export const renderSignedTryoutRows = Effect.fn(
  "NakafaContent.renderSignedTryoutRows"
)(function* (
  access: SignedContentAccess,
  rows: readonly (TryoutBodyBatch | null)[]
) {
  const plan = planTryoutContentBatches(access.questions, access.answers);
  if (rows.length !== plan.batches.length) {
    return yield* new ContentRuntimeVerificationError({
      cause: "Signed try-out rows do not match the content batch plan.",
    });
  }
  return yield* renderContentPlan(plan, (selectors, index) =>
    renderAttemptBatch(selectors, rows[index]).pipe(
      Effect.mapError(toVerificationFailure)
    )
  );
});

/** Renders the public featured question through its exact signed source. */
export const loadTryoutQuestion = Effect.fn("NakafaContent.loadTryoutQuestion")(
  function* (question: TryoutQuestionSelector) {
    const plan = planTryoutContentBatches([question], []);
    const rendered = yield* renderContentPlan(plan, (selectors) =>
      readBatch(selectors).pipe(
        Effect.mapError(
          (cause) =>
            new ContentRuntimeVerificationError({
              cause,
            })
        )
      )
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
      selectors: readonly Selector[],
      index: number
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
    )
  );
  return yield* renderAttemptBatch(selectors, row);
}, Effect.mapError(toVerificationFailure));

/**
 * Wraps one failure of an attempt batch as a verification failure, except an absent batch, which
 * stays itself: the backend answers none for an attempt whose bodies it no longer serves, such as a
 * retired attempt, so its page shows the attempt without them rather than an error.
 */
function toVerificationFailure<E>(cause: E) {
  return Predicate.isTagged(cause, "ContentRuntimeMissingError")
    ? cause
    : new ContentRuntimeVerificationError({ cause });
}

/**
 * Verifies one attempt batch through the verified-batch cache, then renders it on
 * every request. The rendered tree is React, which the store cannot hold, so each
 * load evaluates the verified bodies again.
 */
const renderAttemptBatch = Effect.fn("NakafaContent.renderAttemptBatch")(
  function* (
    selectors: readonly TryoutSelector[],
    row: TryoutBodyBatch | null
  ) {
    const request = yield* makeTryoutRuntimeRequest(selectors);
    const liveRenderer = yield* rendererManifest;
    const found = yield* readVerifiedAttemptBatch(request, row, liveRenderer);
    return yield* renderFoundItems(selectors, found.items);
  }
);

/**
 * Reads, verifies, and renders one featured batch. The runtime answer is kept as
 * received and verified on every read, and it is read again only when the store
 * has no kept answer. The rendered tree is React, which the store cannot hold, so
 * each call renders it again.
 */
const readBatch = Effect.fn("NakafaContent.readTryoutBatch")(function* (
  selectors: readonly TryoutSelector[]
) {
  const request = yield* makeTryoutRuntimeRequest(selectors);
  const liveRenderer = yield* rendererManifest;
  const found = yield* readFeaturedProtectedContent(
    yield* readRuntimeTarget,
    request,
    liveRenderer
  );
  return yield* renderFoundItems(selectors, found.items);
});

/** Renders only the ordered items accepted by signed exchange verification. */
const renderFoundItems = Effect.fn("NakafaContent.renderFoundItems")(function* (
  selectors: readonly TryoutSelector[],
  items: Effect.Success<ReturnType<typeof readVerifiedAttemptBatch>>["items"]
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
      key: "CONTENT_READ_TOKEN",
    }),
  try: () => ({
    siteUrl: env.VITE_CONVEX_SITE_URL,
    token: contentRuntimeKeys().CONTENT_READ_TOKEN,
  }),
});
