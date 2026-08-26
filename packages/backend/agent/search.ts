import {
  decodeAgentInput,
  decodeAgentOutput,
} from "@repo/backend/agent/decode";
import { readAgentQuery } from "@repo/backend/agent/query";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import type {
  contentSearchInputValidator,
  contentSearchResultValidator,
} from "@repo/backend/convex/contents/helpers/search/schema";
import {
  NakafaAgentSearchOptionsSchema,
  NakafaAgentSearchResultSchema,
} from "@repo/contents/_lib/agent/schema/search";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect } from "effect";

const searchReference = makeFunctionReference<
  "query",
  Infer<typeof contentSearchInputValidator>,
  Infer<typeof contentSearchResultValidator>
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
