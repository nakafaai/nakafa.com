import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import type {
  TryoutSectionAttemptPageRequest,
  TryoutSectionAttemptPageResult,
  TryoutSetAttemptPageRequest,
  TryoutSetAttemptPageResult,
} from "@repo/backend/confect/tryouts/attemptPage/spec";
import {
  readActiveTryoutRestartTarget,
  readTryoutDestinationPaths,
} from "@repo/backend/confect/tryouts/catalog/destination";
import {
  readAttemptDestination,
  readAttemptSectionForPath,
} from "@repo/backend/confect/tryouts/runtime/attempt/destination";
import {
  readAttemptSectionPage,
  readAttemptSetPage,
} from "@repo/backend/confect/tryouts/runtime/attempt/page";
import {
  readAttemptSetIdentity,
  readLatestProgressAttempt,
  readOwnedAttemptById,
} from "@repo/backend/confect/tryouts/runtime/lookup";
import { loadSectionAttemptState } from "@repo/backend/confect/tryouts/runtime/section/state";
import { loadSetAttemptState } from "@repo/backend/confect/tryouts/runtime/set/state";
import type { TryoutSetIdentity } from "@repo/backend/content/tryout/set";
import { Array as Arr, Effect, Option } from "effect";

type TryoutAttempt = Docs["tryoutAttempts"];
type RedirectPageResult = Extract<
  NonNullable<TryoutSetAttemptPageResult>,
  {
    readonly kind: "redirect";
  }
>;
type CurrentSetPageResult = Extract<
  NonNullable<TryoutSetAttemptPageResult>,
  {
    readonly kind: "current";
  }
>;
type RetainedSetPageResult = Extract<
  NonNullable<TryoutSetAttemptPageResult>,
  {
    readonly kind: "retained";
  }
>;
type RetainedSectionPageResult = Extract<
  NonNullable<TryoutSectionAttemptPageResult>,
  {
    readonly kind: "retained";
  }
>;

/** Resolves one current set overlay or exact frozen set page. */
export const readSetAttemptPage = Effect.fn(
  "tryouts.attemptPage.readSetAttemptPage"
)(function* (request: TryoutSetAttemptPageRequest) {
  const auth = yield* getOptionalAppUserForRead();
  if (!auth) {
    return null;
  }
  if (request.kind === "current") {
    const attempt = yield* readLatestProgressAttempt(request, auth.appUser._id);
    if (!attempt) {
      return null;
    }
    if (attempt.status === "in-progress") {
      const publicPath = yield* readAttemptDestination(attempt, request.locale);
      if (!publicPath) {
        return null;
      }
      const result: RedirectPageResult = {
        attemptId: attempt._id,
        kind: "redirect",
        publicPath,
      };
      return result;
    }
    return yield* loadCurrentSetPage(attempt, request.locale);
  }
  const attempt = yield* readRetainedAttempt(
    request.attemptId,
    auth.appUser._id
  );
  if (!attempt) {
    return null;
  }
  const destination = yield* readAttemptDestination(attempt, request.locale);
  if (
    request.publicPath !== attempt.setPublicPath &&
    request.publicPath !== destination
  ) {
    return null;
  }
  const identity = readAttemptSetIdentity(attempt);
  if (!destination) {
    return null;
  }
  const { loaded, page, restartTarget } = yield* Effect.all(
    {
      loaded: loadSetAttemptState(attempt, request.locale),
      page: readAttemptSetPage(
        {
          locale: request.locale,
          publicPath: request.publicPath,
        },
        attempt,
        identity
      ),
      restartTarget: readActiveTryoutRestartTarget({
        ...identity,
        locale: request.locale,
      }),
    },
    {
      concurrency: "unbounded",
    }
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
)(function* (request: TryoutSectionAttemptPageRequest) {
  const auth = yield* getOptionalAppUserForRead();
  if (!auth) {
    return null;
  }
  if (request.kind === "current") {
    const attempt = yield* readLatestProgressAttempt(request, auth.appUser._id);
    if (attempt?.status !== "in-progress") {
      return null;
    }
    const snapshot = Option.getOrUndefined(
      Arr.findFirst(
        attempt.sectionSnapshots,
        (section) => section.sectionKey === request.sectionKey
      )
    );
    if (!snapshot?.publicPath) {
      return null;
    }
    const publicPath = yield* readAttemptDestination(
      attempt,
      request.locale,
      request.sectionKey
    );
    if (!publicPath) {
      return null;
    }
    const result: RedirectPageResult = {
      attemptId: attempt._id,
      kind: "redirect",
      publicPath,
    };
    return result;
  }
  const attempt = yield* readRetainedAttempt(
    request.attemptId,
    auth.appUser._id
  );
  if (!attempt) {
    return null;
  }
  const identity = readAttemptSetIdentity(attempt);
  const snapshot = yield* readAttemptSectionForPath(
    attempt,
    request.locale,
    request.publicPath
  );
  if (!snapshot) {
    return null;
  }
  if (
    !(yield* readAttemptDestination(
      attempt,
      request.locale,
      snapshot.sectionKey
    ))
  ) {
    return null;
  }
  const { destinations, loaded, page } = yield* Effect.all(
    {
      destinations: readTryoutDestinationPaths({
        ...identity,
        locale: request.locale,
        sectionKey: snapshot.sectionKey,
      }),
      loaded: loadSectionAttemptState(
        attempt,
        snapshot.sectionKey,
        request.locale
      ),
      page: readAttemptSectionPage(request, attempt),
    },
    {
      concurrency: "unbounded",
    }
  );
  // This same attempt object already supplied the exact section snapshot above.
  const current = yield* Effect.fromNullishOr(loaded).pipe(Effect.orDie);
  const result: RetainedSectionPageResult = {
    activeSectionPublicPath: destinations.activeSectionPublicPath,
    activeSetPublicPath: destinations.activeSetPublicPath,
    attemptId: attempt._id,
    content: current.content,
    initialState: current.state,
    kind: "retained",
    page,
  };
  return result;
});

/** Loads the frozen display rows and mutable terminal state in parallel. */
const loadCurrentSetPage = Effect.fn("tryouts.attemptPage.loadCurrentSetPage")(
  function* (attempt: TryoutAttempt, locale: AppLocaleCode) {
    const identity: TryoutSetIdentity = readAttemptSetIdentity(attempt);
    const { loaded, page, restartTarget } = yield* Effect.all(
      {
        loaded: loadSetAttemptState(attempt, locale),
        page: readAttemptSetPage(
          {
            locale,
            publicPath: attempt.setPublicPath,
          },
          attempt,
          identity
        ),
        restartTarget: readActiveTryoutRestartTarget({ ...identity, locale }),
      },
      {
        concurrency: "unbounded",
      }
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
)(function* (attemptId: string, userId: Docs["users"]["_id"]) {
  const ctx = yield* QueryCtxService;
  const normalized = ctx.db.normalizeId("tryoutAttempts", attemptId);
  if (!normalized) {
    return null;
  }
  return yield* readOwnedAttemptById(normalized, userId);
});
