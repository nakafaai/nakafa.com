import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import type { TryoutSetIdentity } from "@repo/backend/convex/contentRelease/tryout/set";
import { getOptionalAppUserForRead } from "@repo/backend/convex/lib/helpers/auth";
import type {
  TryoutSectionAttemptPageRequest,
  TryoutSectionAttemptPageResult,
  TryoutSetAttemptPageRequest,
  TryoutSetAttemptPageResult,
} from "@repo/backend/convex/tryouts/attemptPage/spec";
import {
  readActiveTryoutRestartTarget,
  readTryoutDestinationPaths,
} from "@repo/backend/convex/tryouts/catalog/destination";
import {
  readAttemptSectionPage,
  readAttemptSetPage,
} from "@repo/backend/convex/tryouts/runtime/attempt/page";
import { tryRuntimePromise } from "@repo/backend/convex/tryouts/runtime/error";
import {
  readAttemptSetIdentity,
  readLatestProgressAttempt,
  readOwnedAttemptById,
} from "@repo/backend/convex/tryouts/runtime/lookup";
import { loadSectionAttemptState } from "@repo/backend/convex/tryouts/runtime/section/state";
import { loadSetAttemptState } from "@repo/backend/convex/tryouts/runtime/set/state";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;
type RedirectPageResult = Extract<
  NonNullable<TryoutSetAttemptPageResult>,
  { readonly kind: "redirect" }
>;
type CurrentSetPageResult = Extract<
  NonNullable<TryoutSetAttemptPageResult>,
  { readonly kind: "current" }
>;
type RetainedSetPageResult = Extract<
  NonNullable<TryoutSetAttemptPageResult>,
  { readonly kind: "retained" }
>;
type RetainedSectionPageResult = Extract<
  NonNullable<TryoutSectionAttemptPageResult>,
  { readonly kind: "retained" }
>;

/** Resolves one current set overlay or exact frozen set page. */
export const readSetAttemptPage = Effect.fn(
  "tryouts.attemptPage.readSetAttemptPage"
)(function* (ctx: QueryCtx, request: TryoutSetAttemptPageRequest) {
  const auth = yield* tryRuntimePromise(() => getOptionalAppUserForRead(ctx));
  if (!auth) {
    return null;
  }

  if (request.kind === "current") {
    const attempt = yield* readLatestProgressAttempt(
      ctx,
      request,
      auth.appUser._id
    );
    if (!attempt) {
      return null;
    }
    if (attempt.status === "in-progress") {
      const result: RedirectPageResult = {
        attemptId: attempt._id,
        kind: "redirect",
        publicPath: attempt.setPublicPath,
      };
      return result;
    }
    return yield* loadCurrentSetPage(ctx, attempt);
  }

  const attempt = yield* readRetainedAttempt(
    ctx,
    request.attemptId,
    auth.appUser._id
  );
  if (!attempt || attempt.setPublicPath !== request.publicPath) {
    return null;
  }

  const identity = yield* readAttemptSetIdentity(attempt);
  if (identity.locale !== request.locale) {
    return null;
  }
  const { loaded, page, restartTarget } = yield* Effect.all(
    {
      loaded: loadSetAttemptState(ctx, attempt),
      page: readAttemptSetPage(
        ctx,
        { locale: request.locale, publicPath: request.publicPath },
        attempt,
        identity
      ),
      restartTarget: readActiveTryoutRestartTarget(ctx, identity),
    },
    { concurrency: "unbounded" }
  );

  const result: RetainedSetPageResult = {
    attemptId: attempt._id,
    content: loaded.content,
    initialState: loaded.state,
    kind: "retained",
    page,
    restartTarget,
  };
  return result;
});

/** Resolves one current section redirect or exact frozen section page. */
export const readSectionAttemptPage = Effect.fn(
  "tryouts.attemptPage.readSectionAttemptPage"
)(function* (ctx: QueryCtx, request: TryoutSectionAttemptPageRequest) {
  const auth = yield* tryRuntimePromise(() => getOptionalAppUserForRead(ctx));
  if (!auth) {
    return null;
  }

  if (request.kind === "current") {
    const attempt = yield* readLatestProgressAttempt(
      ctx,
      request,
      auth.appUser._id
    );
    if (attempt?.status !== "in-progress") {
      return null;
    }
    const snapshot = attempt.sectionSnapshots.find(
      (section) => section.sectionKey === request.sectionKey
    );
    if (!snapshot?.publicPath) {
      return null;
    }
    const result: RedirectPageResult = {
      attemptId: attempt._id,
      kind: "redirect",
      publicPath: snapshot.publicPath,
    };
    return result;
  }

  const attempt = yield* readRetainedAttempt(
    ctx,
    request.attemptId,
    auth.appUser._id
  );
  if (!attempt) {
    return null;
  }
  const identity = yield* readAttemptSetIdentity(attempt);
  if (identity.locale !== request.locale) {
    return null;
  }
  const snapshot = attempt.sectionSnapshots.find(
    (section) => section.publicPath === request.publicPath
  );
  if (!snapshot) {
    return null;
  }

  const { destinations, loaded, page } = yield* Effect.all(
    {
      destinations: readTryoutDestinationPaths(ctx, {
        ...identity,
        sectionKey: snapshot.sectionKey,
      }),
      loaded: loadSectionAttemptState(ctx, attempt, snapshot.sectionKey),
      page: readAttemptSectionPage(ctx, request, attempt),
    },
    { concurrency: "unbounded" }
  );
  if (!loaded) {
    return null;
  }

  const result: RetainedSectionPageResult = {
    activeSectionPublicPath: destinations.activeSectionPublicPath,
    activeSetPublicPath: destinations.activeSetPublicPath,
    attemptId: attempt._id,
    content: loaded.content,
    initialState: loaded.state,
    kind: "retained",
    page,
  };
  return result;
});

/** Loads the frozen display rows and mutable terminal state in parallel. */
const loadCurrentSetPage = Effect.fn("tryouts.attemptPage.loadCurrentSetPage")(
  function* (ctx: QueryCtx, attempt: TryoutAttempt) {
    const identity: TryoutSetIdentity = yield* readAttemptSetIdentity(attempt);
    const { loaded, page, restartTarget } = yield* Effect.all(
      {
        loaded: loadSetAttemptState(ctx, attempt),
        page: readAttemptSetPage(
          ctx,
          { locale: identity.locale, publicPath: attempt.setPublicPath },
          attempt,
          identity
        ),
        restartTarget: readActiveTryoutRestartTarget(ctx, identity),
      },
      { concurrency: "unbounded" }
    );

    const result: CurrentSetPageResult = {
      attemptId: attempt._id,
      content: loaded.content,
      initialState: loaded.state,
      kind: "current",
      page,
      restartTarget,
    };
    return result;
  }
);

/** Normalizes one untrusted ID before applying exact ownership checks. */
const readRetainedAttempt = Effect.fn(
  "tryouts.attemptPage.readRetainedAttempt"
)(function* (ctx: QueryCtx, attemptId: string, userId: Doc<"users">["_id"]) {
  const normalized = ctx.db.normalizeId("tryoutAttempts", attemptId);
  if (!normalized) {
    return null;
  }
  return yield* readOwnedAttemptById(ctx, normalized, userId);
});
