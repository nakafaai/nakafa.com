import { api } from "@repo/backend/convex/_generated/api";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/_lib/agent/errors";
import { ConvexHttpClient } from "convex/browser";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import { Effect } from "effect";
import { env } from "@/env";

type ArticlePageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getArticlePage
>;
type SubjectPageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getSubjectPage
>;
type ExerciseSetPageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getExerciseSetPage
>;
type ExerciseQuestionPageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getExerciseQuestionPage
>;
type ExerciseGroupPageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getExerciseGroupPage
>;

/**
 * Reads an article page from Convex through a Promise boundary for static RSCs.
 *
 * This avoids starting Effect's runtime before Next.js observes uncached data
 * during prerender. See https://nextjs.org/docs/messages/next-prerender-current-time.
 */
export function fetchRuntimeArticlePage(args: ArticlePageArgs) {
  return fetchRuntimeQuery(api.contents.queries.runtime.getArticlePage, args);
}

/**
 * Reads a subject lesson from Convex through a Promise boundary for static RSCs.
 *
 * This avoids starting Effect's runtime before Next.js observes uncached data
 * during prerender. See https://nextjs.org/docs/messages/next-prerender-current-time.
 */
export function fetchRuntimeSubjectPage(args: SubjectPageArgs) {
  return fetchRuntimeQuery(api.contents.queries.runtime.getSubjectPage, args);
}

/**
 * Reads an exercise set from Convex through a Promise boundary for static RSCs.
 *
 * This avoids starting Effect's runtime before Next.js observes uncached data
 * during prerender. See https://nextjs.org/docs/messages/next-prerender-current-time.
 */
export function fetchRuntimeExerciseSetPage(args: ExerciseSetPageArgs) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.getExerciseSetPage,
    args
  );
}

/**
 * Reads one exercise question from Convex through a Promise boundary for static RSCs.
 *
 * This avoids starting Effect's runtime before Next.js observes uncached data
 * during prerender. See https://nextjs.org/docs/messages/next-prerender-current-time.
 */
export function fetchRuntimeExerciseQuestionPage(
  args: ExerciseQuestionPageArgs
) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.getExerciseQuestionPage,
    args
  );
}

/**
 * Reads an exercise group from Convex through a Promise boundary for static RSCs.
 *
 * This avoids starting Effect's runtime before Next.js observes uncached data
 * during prerender. See https://nextjs.org/docs/messages/next-prerender-current-time.
 */
export function fetchRuntimeExerciseGroupPage(args: ExerciseGroupPageArgs) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.getExerciseGroupPage,
    args
  );
}

/**
 * Fetches one public content-runtime query through the official Convex client.
 *
 * `convex/nextjs` does not expose logger configuration. Its default
 * `ConvexHttpClient` logger allocates a random listener id, which Next Cache
 * Components reject during static prerender. A short-lived official client with
 * `logger: false` and a public custom fetch keeps this boundary framework-safe
 * without copying protocol.
 */
function fetchRuntimeQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query>
): Promise<FunctionReturnType<Query>> {
  const client = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL, {
    fetch: fetchNoStore,
    logger: false,
  });

  return client.query(query, args);
}

/** Forces official Convex client reads to bypass Next fetch caching. */
const fetchNoStore: typeof fetch = (input, init) =>
  fetch(input, {
    ...init,
    cache: "no-store",
  });

/** Wraps a Convex runtime query in the agent data-read error model. */
function fetchContentRuntimeQuery<T>(name: string, read: () => Promise<T>) {
  return Effect.tryPromise({
    try: read,
    catch: (error) =>
      new NakafaAgentDataReadError({
        cause: getUnknownErrorMessage(error),
        message: `Unable to read Nakafa runtime content query: ${name}.`,
      }),
  });
}

/** Reads an article page from the Convex content runtime model. */
export const getRuntimeArticlePage = Effect.fn("www.contentRuntime.article")(
  function* (args: ArticlePageArgs) {
    return yield* fetchContentRuntimeQuery("getArticlePage", () =>
      fetchRuntimeArticlePage(args)
    );
  }
);

/** Reads a subject lesson from the Convex content runtime model. */
export const getRuntimeSubjectPage = Effect.fn("www.contentRuntime.subject")(
  function* (args: SubjectPageArgs) {
    return yield* fetchContentRuntimeQuery("getSubjectPage", () =>
      fetchRuntimeSubjectPage(args)
    );
  }
);

/** Reads an exercise set from the Convex content runtime model. */
export const getRuntimeExerciseSetPage = Effect.fn(
  "www.contentRuntime.exerciseSet"
)(function* (args: ExerciseSetPageArgs) {
  return yield* fetchContentRuntimeQuery("getExerciseSetPage", () =>
    fetchRuntimeExerciseSetPage(args)
  );
});

/** Reads a single exercise question from the Convex content runtime model. */
export const getRuntimeExerciseQuestionPage = Effect.fn(
  "www.contentRuntime.exerciseQuestion"
)(function* (args: ExerciseQuestionPageArgs) {
  return yield* fetchContentRuntimeQuery("getExerciseQuestionPage", () =>
    fetchRuntimeExerciseQuestionPage(args)
  );
});

/** Reads an exercise group route from the Convex content runtime model. */
export const getRuntimeExerciseGroupPage = Effect.fn(
  "www.contentRuntime.exerciseGroup"
)(function* (args: ExerciseGroupPageArgs) {
  return yield* fetchContentRuntimeQuery("getExerciseGroupPage", () =>
    fetchRuntimeExerciseGroupPage(args)
  );
});
