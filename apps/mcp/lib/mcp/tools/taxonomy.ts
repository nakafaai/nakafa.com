import { Nakafa } from "@repo/ai/agents/nakafa/service";
import {
  NakafaAgentTaxonomyOptionsSchema,
  NakafaAgentTaxonomySchema,
} from "@repo/contents/_lib/agent/schema/taxonomy";
import { Effect } from "effect";
import { decodeNakafaMcpToolInput } from "@/lib/mcp/effect";
import { nakafaContent } from "@/lib/mcp/nakafa";
import {
  succeedMcpReadModelError,
  toMcpStructuredResult,
} from "@/lib/mcp/result";

export const NakafaGetTaxonomyToolInputSchema =
  NakafaAgentTaxonomyOptionsSchema;
export const NakafaGetTaxonomyToolOutputSchema = NakafaAgentTaxonomySchema;

/** Builds the taxonomy and endpoint guidance tool result. */
export function getNakafaTaxonomyToolResult(args: unknown) {
  return Effect.gen(function* () {
    const input = yield* decodeNakafaMcpToolInput(
      NakafaGetTaxonomyToolInputSchema,
      args,
      "Invalid Nakafa taxonomy options."
    );
    const taxonomy = yield* Nakafa.taxonomy(input.locale).pipe(
      Effect.provideService(Nakafa, nakafaContent)
    );

    return toMcpStructuredResult(taxonomy);
  }).pipe(
    Effect.catchTags({
      NakafaAgentDataReadError: succeedMcpReadModelError,
      NakafaAgentInputError: succeedMcpReadModelError,
    })
  );
}
