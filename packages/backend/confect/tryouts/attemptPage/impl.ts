import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import type {
  currentSetResultValidator,
  redirectResultValidator,
  retainedSectionResultValidator,
  retainedSetResultValidator,
  TryoutSectionAttemptPageRequest,
  TryoutSetAttemptPageRequest,
} from "@repo/backend/confect/tryouts/attemptPage/spec";
import {
  readActiveTryoutRestartTarget,
  readTryoutDestinationPaths,
} from "@repo/backend/confect/tryouts/catalog/destination";
import type { TryoutSetIdentity } from "@repo/backend/confect/tryouts/route";
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
import { Effect } from "effect";

type TryoutAttempt = Docs["tryoutAttempts"];
type RedirectPageResult = typeof redirectResultValidator.Type;
type CurrentSetPageResult = typeof currentSetResultValidator.Type;
type RetainedSetPageResult = typeof retainedSetResultValidator.Type;
type RetainedSectionPageResult = typeof retainedSectionResultValidator.Type;

/** Resolves one current set overlay or exact frozen set page. */
export const readSetAttemptPage = Effect.fn(
  "tryouts.attemptPage.readSetAttemptPage"
)(function* (request: TryoutSetAttemptPageRequest) {
  const auth = yield* getOptionalAppUserForRead();
  if (!auth) {
    return null;
  }
  const attempt =
    request.kind === "current"
      ? yield* readLatestProgressAttempt(request, auth.appUser._id)
      : yield* readRetainedAttempt(request.attemptId, auth.appUser._id);
  if (!attempt) {
    return null;
  }
  const setPath = yield* readAttemptDestination(attempt, request.locale);
  if (!setPath) {
    return null;
  }
  if (request.kind === "retained") {
    if (
      request.publicPath !== attempt.setPublicPath &&
      request.publicPath !== setPath
    ) {
      return null;
    }
    const result: RetainedSetPageResult = {
      ...(yield* loadSetPage(attempt, request.locale, setPath)),
      kind: "retained",
    };
    return result;
  }
  if (attempt.status === "in-progress") {
    const result: RedirectPageResult = {
      attemptId: attempt._id,
      kind: "redirect",
      publicPath: setPath,
    };
    return result;
  }
  const result: CurrentSetPageResult = {
    ...(yield* loadSetPage(attempt, request.locale, setPath)),
    kind: "current",
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
  const frozen = yield* readAttemptSectionForPath(
    attempt,
    request.locale,
    request.publicPath
  );
  if (!frozen) {
    return null;
  }
  const sectionPath = yield* readAttemptDestination(
    attempt,
    request.locale,
    frozen.sectionKey
  );
  if (!sectionPath) {
    return null;
  }
  const { destinations, loaded, page } = yield* Effect.all(
    {
      destinations: readTryoutDestinationPaths({
        ...readAttemptSetIdentity(attempt),
        locale: request.locale,
        sectionKey: frozen.sectionKey,
      }),
      loaded: loadSectionAttemptState(
        attempt,
        frozen.sectionKey,
        request.locale
      ),
      page: readAttemptSectionPage(attempt, request.locale, sectionPath),
    },
    {
      concurrency: "unbounded",
    }
  );
  // This same attempt object already supplied the exact frozen section above.
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

/** Loads an attempt's set page at its set route, its state, and where its set restarts now, in parallel. */
const loadSetPage = Effect.fn("tryouts.attemptPage.loadSetPage")(function* (
  attempt: TryoutAttempt,
  locale: AppLocaleCode,
  setPath: string
) {
  const identity: TryoutSetIdentity = readAttemptSetIdentity(attempt);
  const { loaded, page, restartTarget } = yield* Effect.all(
    {
      loaded: loadSetAttemptState(attempt, locale),
      page: readAttemptSetPage(attempt, locale, setPath),
      restartTarget: readActiveTryoutRestartTarget({ ...identity, locale }),
    },
    {
      concurrency: "unbounded",
    }
  );
  return {
    attemptId: attempt._id,
    content: loaded.content,
    initialState: loaded.state,
    page,
    restartTarget,
  };
});

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
