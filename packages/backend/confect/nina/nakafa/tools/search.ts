import { searchNakafaContent } from "@repo/backend/agent/search";
import type { CapabilityProgress } from "@repo/backend/confect/nina/capability/progress";
import {
  formatSearchGroup,
  getSearchTokens,
  rankSearchResult,
} from "@repo/backend/confect/nina/nakafa/search";
import type { NakafaAgentSearchInput } from "@repo/contents/agent/schema/search";
import type { Locale } from "@repo/contents/content";
import { Effect, Result } from "effect";

/** Searches Nakafa content and writes a bounded `data-nakafa` UI part. */
export const search = Effect.fn("nakafa.search")(function* ({
  input,
  locale,
  toolCallId,
  publish,
}: {
  readonly input: NakafaAgentSearchInput;
  readonly locale: Locale;
  readonly toolCallId: string;
  readonly publish: CapabilityProgress;
}) {
  const dataInput = getSearchInput(input, locale);
  const partId = getNakafaSearchPartId(toolCallId);
  yield* publish({
    id: partId,
    type: "data-nakafa",
    data: {
      kind: "search",
      input: dataInput,
      status: "loading",
    },
  });
  const result = yield* Effect.result(
    searchNakafaContent(dataInput).pipe(
      Effect.map((searchResult) =>
        rankSearchResult(searchResult, getSearchTokens(dataInput.queries ?? []))
      )
    )
  );
  if (Result.isFailure(result)) {
    yield* publish({
      id: partId,
      type: "data-nakafa",
      data: {
        kind: "search",
        input: dataInput,
        status: "error",
        error: result.failure.message,
      },
    });
    return {
      result: null,
      text: result.failure.message,
    };
  }
  yield* publish({
    id: partId,
    type: "data-nakafa",
    data: {
      kind: "search",
      input: dataInput,
      status: "done",
      result: result.success,
    },
  });
  return {
    result: result.success,
    text: formatSearchGroup(dataInput, result.success),
  };
});
/** Applies server-owned locale before calling the Convex-backed search adapter. */
function getSearchInput(input: NakafaAgentSearchInput, locale: Locale) {
  return {
    limit: input.limit,
    locale,
    offset: input.offset,
    ...(input.queries === undefined ? {} : { queries: input.queries }),
    ...(input.section === undefined ? {} : { section: input.section }),
  };
}
/** Derives the stable UI data-part id for one Nakafa search request. */
function getNakafaSearchPartId(toolCallId: string) {
  return `${toolCallId}-1`;
}
