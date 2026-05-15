import { formatSearch } from "@repo/ai/agents/nakafa/format";
import { NakafaSearch } from "@repo/ai/agents/nakafa/search";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { NakafaAgentSearchInput } from "@repo/contents/_lib/agent/schema/search";
import type { Locale } from "@repo/contents/_types/content";
import type { UIMessageStreamWriter } from "ai";
import { Effect, Either } from "effect";

type Writer = Pick<UIMessageStreamWriter<MyUIMessage>, "write">;

interface Params {
  input: NakafaAgentSearchInput;
  locale: Locale;
  toolCallId: string;
  writer: Writer;
}

/** Searches Nakafa content and writes a bounded `data-nakafa` UI part. */
export const search = Effect.fn("nakafa.search")(function* ({
  input,
  locale,
  toolCallId,
  writer,
}: Params) {
  const dataInput = getSearchInput(input, locale);

  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-nakafa",
      data: {
        kind: "search",
        input: dataInput,
        status: "loading",
      },
    })
  );

  const nakafaSearch = yield* NakafaSearch;
  const result = yield* Effect.either(nakafaSearch.search(dataInput));

  if (Either.isLeft(result)) {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-nakafa",
        data: {
          kind: "search",
          input: dataInput,
          status: "error",
          error: result.left.message,
        },
      })
    );

    return {
      result: null,
      text: result.left.message,
    };
  }

  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-nakafa",
      data: {
        kind: "search",
        input: dataInput,
        status: "done",
        result: result.right,
      },
    })
  );

  return {
    result: result.right,
    text: formatSearch(result.right),
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
