import {
  decodeAgentInput,
  decodeAgentOutput,
} from "@repo/backend/agent/decode";
import refs from "@repo/backend/confect/_generated/refs";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import { NakafaAgentDataReadError } from "@repo/contents/agent/errors";
import {
  NakafaAgentSearchOptionsSchema,
  NakafaAgentSearchResultSchema,
} from "@repo/contents/agent/schema/search";
import { Effect } from "effect";

const searchReference = refs.public.contents.queries.search.search;

/** Searches the signed Nakafa read model without a network hop. */
export const searchNakafaContent = Effect.fn("agent.searchNakafaContent")(
  function* (input: unknown) {
    const { runQuery } = yield* QueryRunner;
    const options = yield* decodeAgentInput(
      NakafaAgentSearchOptionsSchema,
      input,
      "Invalid Nakafa content search options."
    );
    const result = yield* runQuery(searchReference, options).pipe(
      Effect.mapError(
        (cause) =>
          new NakafaAgentDataReadError({
            cause: getUnknownErrorMessage(cause),
            message: "Unable to search Nakafa content.",
          })
      )
    );
    return yield* decodeAgentOutput(
      NakafaAgentSearchResultSchema,
      result,
      "Nakafa content search returned invalid data."
    );
  }
);
