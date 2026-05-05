import {
  NAKAFA_MCP_DIRECT_ENDPOINT,
  NAKAFA_MCP_INFORMATIONAL_ROOT,
  NAKAFA_MCP_RECOMMENDED_ENDPOINT,
} from "@repo/contents/_lib/agent/constants";
import { getNakafaAgentTaxonomy } from "@repo/contents/_lib/agent/taxonomy";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("Nakafa agent taxonomy", () => {
  it("returns taxonomy counts and endpoint guidance", async () => {
    const taxonomy = await Effect.runPromise(getNakafaAgentTaxonomy("en"));
    const defaultTaxonomy = await Effect.runPromise(getNakafaAgentTaxonomy());

    expect(taxonomy.default_locale).toBe("en");
    expect(defaultTaxonomy.locale).toBe("en");
    expect(taxonomy.endpoints.recommended).toBe(
      NAKAFA_MCP_RECOMMENDED_ENDPOINT
    );
    expect(taxonomy.endpoints.direct).toBe(NAKAFA_MCP_DIRECT_ENDPOINT);
    expect(taxonomy.endpoints.root_note).toContain(
      NAKAFA_MCP_INFORMATIONAL_ROOT
    );
    expect(taxonomy.tools).toStrictEqual([
      "nakafa_search_content",
      "nakafa_get_content",
      "nakafa_get_taxonomy",
      "nakafa_get_exercise",
      "nakafa_get_quran_reference",
    ]);
  });
});
