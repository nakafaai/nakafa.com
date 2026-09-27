import { describe, expect, it } from "@effect/vitest";
import {
  NakafaAgentSearchFactsSchema,
  NakafaAgentSearchOptionsSchema,
} from "@repo/contents/agent/schema/search";
import { NAKAFA_AGENT_SEARCH_WINDOW } from "@repo/contents/agent/search";
import { Schema } from "effect";

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
