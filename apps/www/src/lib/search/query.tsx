import { Effect, Fiber, Option, Result } from "effect";
import { useEffect, useState } from "react";
import { useLocale } from "use-intl";
import { isActiveLocale } from "@/lib/i18n/active";
import {
  type ContentSearchResultItem,
  requestSearch,
  type SearchAnswers,
  SearchReadError,
  settleSearch,
  startSearch,
} from "@/lib/search/answer";
import { readSearchFn } from "@/lib/search/search.functions";

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
  const [stored, setAnswers] = useState<SearchAnswers<ContentSearchResultItem>>(
    () => startSearch(key)
  );
  const answers = requestSearch(stored, key);
  if (answers !== stored) {
    setAnswers(answers);
  }

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
              setAnswers((previous) =>
                settleSearch(previous, key, Result.fail(error))
              );
            }),
          onSuccess: (items) =>
            Effect.sync(() => {
              setAnswers((previous) =>
                settleSearch(previous, key, Result.succeed(items))
              );
            }),
        })
      )
    );
    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [key, locale, normalizedQuery, shouldSearch]);

  if (!shouldSearch) {
    return { data: [], error: undefined, isError: false, isLoading: false };
  }

  const answer = answers.key === key ? answers.answer : Option.none();
  if (Option.isNone(answer)) {
    return { data: [], error: undefined, isError: false, isLoading: true };
  }
  if (Result.isFailure(answer.value)) {
    return {
      data: [],
      error: answer.value.failure,
      isError: true,
      isLoading: false,
    };
  }
  return {
    data: answer.value.success,
    error: undefined,
    isError: false,
    isLoading: false,
  };
}
