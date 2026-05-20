import {
  NAKAFA_MCP_DIRECT_ENDPOINT,
  NAKAFA_MCP_INFORMATIONAL_ROOT,
  NAKAFA_MCP_RECOMMENDED_ENDPOINT,
} from "@repo/contents/_lib/agent/constants";
import { getNakafaAgentTaxonomy } from "@repo/contents/_lib/agent/taxonomy/read";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

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
    expect(taxonomy.exercises.materials).toContainEqual({
      id: "quantitative-knowledge",
      label: "Quantitative Knowledge",
    });
    expect(taxonomy.tools).toStrictEqual([
      "nakafa_search_content",
      "nakafa_get_content",
      "nakafa_get_taxonomy",
      "nakafa_get_exercise",
      "nakafa_get_quran_reference",
    ]);
  });

  it("fails with a typed read error when the taxonomy schema rejects output", async () => {
    vi.resetModules();
    vi.doMock("@repo/contents/_lib/agent/schema/taxonomy", async () => {
      const { Schema } = await import("effect");

      return {
        NakafaAgentTaxonomySchema: Schema.Struct({
          impossible: Schema.String,
        }),
      };
    });

    const { NakafaAgentDataReadError } = await import(
      "@repo/contents/_lib/agent/errors"
    );
    const { getNakafaAgentTaxonomy } = await import(
      "@repo/contents/_lib/agent/taxonomy/read"
    );
    const error = await Effect.runPromise(
      Effect.match(getNakafaAgentTaxonomy("en"), {
        onFailure: (failure) => failure,
        onSuccess: () => null,
      })
    );

    expect(error).toBeInstanceOf(NakafaAgentDataReadError);
    vi.doUnmock("@repo/contents/_lib/agent/schema/taxonomy");
    vi.resetModules();
  });
});
