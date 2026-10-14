import { describe, expect, it } from "@effect/vitest";
import {
  NakafaAgentSearchFactsSchema,
  NakafaAgentSearchOptionsSchema,
} from "@repo/contents/agent/schema/search";
import {
  CONVEX_SEARCH_TERMS,
  NAKAFA_AGENT_MAX_QUERY_LENGTH,
  NAKAFA_AGENT_SEARCH_WINDOW,
} from "@repo/contents/agent/search";
import { Array as Arr, Result, Schema } from "effect";

describe("NakafaAgentSearchOptionsSchema", () => {
  it("preserves executed searches without admitting requests beyond today's limits", () => {
    const executed = {
      locale: "id",
      limit: 20,
      offset: 100,
      queries: ["algebra"],
    };
    expect(
      Schema.decodeUnknownSync(NakafaAgentSearchFactsSchema)(executed)
    ).toEqual(executed);
    expect(Schema.is(NakafaAgentSearchOptionsSchema)(executed)).toBe(false);
    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentSearchFactsSchema)({
        limit: 20,
        offset: 0,
      })
    ).toThrow();
    expect(
      Schema.is(NakafaAgentSearchFactsSchema)({ ...executed, limit: -1 })
    ).toBe(false);
  });
  it("tells clients how long a query may be and how many terms it may hold, refuses a longer one, and still reads a recorded one", () => {
    // The longest query that the 16 terms Convex reads can fill: each term is
    // 31 bytes, the most it keeps, with one space between each two.
    const atLimit = Arr.join(Arr.replicate("a".repeat(31), 16), " ");
    const search = (query: string) => ({
      limit: 10,
      locale: "en",
      offset: 0,
      queries: [query],
    });
    const decode = (query: string) =>
      Schema.decodeUnknownResult(NakafaAgentSearchOptionsSchema)(search(query));

    expect(Result.isSuccess(decode(atLimit))).toBe(true);
    expect(Result.isFailure(decode(`${atLimit}a`))).toBe(true);
    // The length is measured as written, before the query is trimmed.
    expect(Result.isFailure(decode(`${atLimit} `))).toBe(true);
    // Characters count by code point, as the JSON schema counts them: 𠮷 is
    // one, though JavaScript stores it as two units.
    expect(
      Result.isSuccess(decode("𠮷".repeat(NAKAFA_AGENT_MAX_QUERY_LENGTH)))
    ).toBe(true);
    expect(
      Result.isFailure(decode("𠮷".repeat(NAKAFA_AGENT_MAX_QUERY_LENGTH + 1)))
    ).toBe(true);
    // The schema that the MCP tool, the public API and Nina's tool carry says
    // it, and says how many terms the search reads, which a short query can
    // exceed.
    expect(
      Schema.toJsonSchemaDocument(NakafaAgentSearchOptionsSchema).schema
    ).toMatchObject({
      properties: {
        queries: {
          description: expect.stringContaining(
            `within ${CONVEX_SEARCH_TERMS} terms`
          ),
          items: { maxLength: NAKAFA_AGENT_MAX_QUERY_LENGTH },
        },
      },
    });
    // A search recorded with a longer query before the limit still decodes.
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(NakafaAgentSearchFactsSchema)(
          search(`${atLimit}a`)
        )
      )
    ).toBe(true);
  });
  it("applies the documented search defaults", () => {
    expect(Schema.decodeSync(NakafaAgentSearchOptionsSchema)({})).toEqual({
      limit: NAKAFA_AGENT_SEARCH_WINDOW,
      locale: "en",
      offset: 0,
    });
  });

  it("accepts an offset within the shared authenticated window", () => {
    expect(
      Schema.decodeSync(NakafaAgentSearchOptionsSchema)({
        offset: NAKAFA_AGENT_SEARCH_WINDOW - 1,
      })
    ).toEqual({
      limit: NAKAFA_AGENT_SEARCH_WINDOW,
      locale: "en",
      offset: NAKAFA_AGENT_SEARCH_WINDOW - 1,
    });
  });
});
