import {
  NAKAFA_MCP_INFORMATIONAL_ROOT,
  NAKAFA_MCP_LEGACY_ENDPOINT,
} from "@repo/contents/_lib/agent/constants";
import type {
  NakafaAgentLegacyTaxonomy,
  NakafaAgentTaxonomy,
} from "@repo/contents/_lib/agent/schema/taxonomy";

/** Projects current taxonomy data into the deployed SDK 1.30 endpoint contract. */
export function toLegacyNakafaTaxonomy(
  taxonomy: NakafaAgentTaxonomy
): NakafaAgentLegacyTaxonomy {
  const { endpoints, ...contentTaxonomy } = taxonomy;

  return {
    ...contentTaxonomy,
    endpoints: {
      direct: endpoints.mcp,
      recommended: NAKAFA_MCP_LEGACY_ENDPOINT,
      root_note: `${NAKAFA_MCP_INFORMATIONAL_ROOT} is informational only.`,
    },
  };
}
