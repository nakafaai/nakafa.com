import {
  NakafaAgentTaxonomyOptionsSchema,
  NakafaAgentTaxonomySchema,
} from "@repo/contents/_lib/agent/schema/taxonomy";
import { Nakafa } from "@repo/contents/_lib/agent/service";
import { Effect } from "effect";
import { decodeNakafaMcpToolInput } from "@/lib/mcp/effect";
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
      Effect.provide(Nakafa.Default)
    );

    return toMcpStructuredResult(taxonomy);
  }).pipe(
    Effect.catchTags({
      NakafaAgentDataReadError: succeedMcpReadModelError,
      NakafaAgentInputError: succeedMcpReadModelError,
    })
  );
}
