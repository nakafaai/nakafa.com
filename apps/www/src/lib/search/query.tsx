import type { Ref } from "@confect/core";
import type contents from "@repo/backend/confect/_generated/refs/contents";
import { Effect, Fiber, Result, Schema } from "effect";
import { useEffect, useState } from "react";
import { useLocale } from "use-intl";
import { isActiveLocale } from "@/lib/i18n/active";
import { readSearchFn } from "@/lib/search/search.functions";

type ContentSearchResponse = Ref.Returns<typeof contents.queries.search.search>;

export type ContentSearchResultItem = ContentSearchResponse["items"][number];

/** A content search could not be read, so the results show the failure. */
class SearchReadError extends Schema.TaggedError<SearchReadError>()(
  "SearchReadError",
  { cause: Schema.Unknown }
) {}

/**
 * Runs the public content search for the active locale. Every viewer reads it
 * through the server function, so a search opens no Convex client or socket.
 * Only the newest query's results show: a response for an older text is dropped.
 */
export function useSearchQuery({
  enabled,
  query,
}: {
  enabled: boolean;
  query: string;
}) {
  const locale = useLocale();
  const normalizedQuery = query.trim();
  const shouldSearch =
    enabled && normalizedQuery.length > 0 && isActiveLocale(locale);
  const key = `${locale}\n${normalizedQuery}`;
  const [answer, setAnswer] = useState<{
    readonly key: string;
    readonly result: Result.Result<ContentSearchResultItem[], SearchReadError>;
  } | null>(null);

  useEffect(() => {
    if (!(shouldSearch && isActiveLocale(locale))) {
      return;
    }
    const fiber = Effect.runFork(
      Effect.tryPromise({
        try: () => readSearchFn({ data: { locale, query: normalizedQuery } }),
        catch: (cause) => new SearchReadError({ cause }),
      }).pipe(
        Effect.matchEffect({
          onFailure: (error) =>
            Effect.sync(() => {
              setAnswer({ key, result: Result.fail(error) });
            }),
          onSuccess: (items) =>
            Effect.sync(() => {
              setAnswer({ key, result: Result.succeed(items) });
            }),
        })
      )
    );
    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [key, locale, normalizedQuery, shouldSearch]);

  if (!shouldSearch) {
    return {
      data: [],
      error: null,
      isError: false,
      isLoading: false,
    };
  }

  if (answer === null || answer.key !== key) {
    return {
      data: [],
      error: null,
      isError: false,
      isLoading: true,
    };
  }

  if (Result.isFailure(answer.result)) {
    return {
      data: [],
      error: answer.result.failure,
      isError: true,
      isLoading: false,
    };
  }

  return {
    data: answer.result.success,
    error: null,
    isError: false,
    isLoading: false,
  };
}
