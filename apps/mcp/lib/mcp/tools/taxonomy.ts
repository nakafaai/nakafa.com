import { Nakafa } from "@repo/ai/agents/nakafa/service";
import {
  NakafaAgentLegacyTaxonomySchema,
  NakafaAgentTaxonomyOptionsSchema,
} from "@repo/contents/_lib/agent/schema/taxonomy";
import { Effect } from "effect";
import { decodeNakafaMcpToolInput } from "@/lib/mcp/effect";
import { nakafaContent } from "@/lib/mcp/nakafa";
import {
  succeedMcpReadModelError,
  toMcpStructuredResult,
} from "@/lib/mcp/result";
import { toLegacyNakafaTaxonomy } from "@/lib/mcp/taxonomy";
export const NakafaGetTaxonomyToolInputSchema =
  NakafaAgentTaxonomyOptionsSchema;
export const NakafaGetTaxonomyToolOutputSchema =
  NakafaAgentLegacyTaxonomySchema;
/** Builds the taxonomy and endpoint guidance tool result. */
export function getNakafaTaxonomyToolResult(args: unknown) {
  return Effect.gen(function* () {
    const input = yield* decodeNakafaMcpToolInput(
      NakafaGetTaxonomyToolInputSchema,
      args,
      "Invalid Nakafa taxonomy options."
    );
    const taxonomy = yield* Nakafa.use((service) =>
      service.taxonomy(input.locale)
    ).pipe(Effect.provideService(Nakafa, nakafaContent));
    return toMcpStructuredResult(toLegacyNakafaTaxonomy(taxonomy));
  }).pipe(
    Effect.catchTags({
      NakafaAgentDataReadError: succeedMcpReadModelError,
      NakafaAgentInputError: succeedMcpReadModelError,
    })
  );
}
