import {
  decodeAgentInput,
  decodeAgentOutput,
} from "@repo/backend/agent/decode";
import { readAgentQuery } from "@repo/backend/agent/query";
import type {
  contentSearchInputValidator,
  contentSearchResultValidator,
} from "@repo/backend/confect/contents/helpers/search/schema";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import {
  NakafaAgentSearchOptionsSchema,
  NakafaAgentSearchResultSchema,
} from "@repo/contents/agent/schema/search";
import { makeFunctionReference } from "convex/server";
import { Effect, type Schema } from "effect";

const searchReference = makeFunctionReference<
  "query",
  Schema.Schema.Type<typeof contentSearchInputValidator>,
  Schema.Schema.Type<typeof contentSearchResultValidator>
>("contents/queries/search:search");

/** Searches the signed Nakafa read model without a network hop. */
export const searchNakafaContent = Effect.fn("agent.searchNakafaContent")(
  function* (ctx: ActionCtx, input: unknown) {
    const options = yield* decodeAgentInput(
      NakafaAgentSearchOptionsSchema,
      input,
      "Invalid Nakafa content search options."
    );
    const result = yield* readAgentQuery(
      ctx,
      searchReference,
      options,
      "Unable to search Nakafa content."
    );
    return yield* decodeAgentOutput(
      NakafaAgentSearchResultSchema,
      result,
      "Nakafa content search returned invalid data."
    );
  }
);
