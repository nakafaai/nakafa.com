import { describe, expect, it } from "@effect/vitest";
import {
  NakafaAgentSearchFactsSchema,
  NakafaAgentSearchOptionsSchema,
} from "@repo/contents/agent/schema/search";
import { NAKAFA_AGENT_SEARCH_WINDOW } from "@repo/contents/agent/search";
import { Array as Arr, Schema } from "effect";

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
  it("refuses a query longer than the search can use, and still reads a recorded one", () => {
    // The longest query that the 16 terms Convex reads can fill: each term is
    // 31 bytes, the most it keeps, with one space between each two.
    const atLimit = Arr.join(Arr.replicate("a".repeat(31), 16), " ");
    const search = (query: string) => ({
      limit: 10,
      locale: "en",
      offset: 0,
      queries: [query],
    });

    expect(Schema.is(NakafaAgentSearchOptionsSchema)(search(atLimit))).toBe(
      true
    );
    expect(
      Schema.is(NakafaAgentSearchOptionsSchema)(search(`${atLimit}a`))
    ).toBe(false);
    // A search recorded with a longer query before the limit still decodes.
    expect(Schema.is(NakafaAgentSearchFactsSchema)(search(`${atLimit}a`))).toBe(
      true
    );
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
