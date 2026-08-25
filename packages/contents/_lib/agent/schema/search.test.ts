import { NakafaAgentSearchOptionsSchema } from "@repo/contents/_lib/agent/schema/search";
import {
  NAKAFA_AGENT_DEFAULT_LIMIT,
  NAKAFA_AGENT_SEARCH_WINDOW,
} from "@repo/contents/_types/agent/search";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("NakafaAgentSearchOptionsSchema", () => {
  it("applies the documented search defaults", () => {
    expect(Schema.decodeSync(NakafaAgentSearchOptionsSchema)({})).toEqual({
      limit: NAKAFA_AGENT_DEFAULT_LIMIT,
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
      limit: NAKAFA_AGENT_DEFAULT_LIMIT,
      locale: "en",
      offset: NAKAFA_AGENT_SEARCH_WINDOW - 1,
    });
  });

  it("rejects a page outside the transaction-proven window", () => {
    expect(() =>
      Schema.decodeSync(NakafaAgentSearchOptionsSchema)({
        limit: NAKAFA_AGENT_SEARCH_WINDOW + 1,
      })
    ).toThrow();
    expect(() =>
      Schema.decodeSync(NakafaAgentSearchOptionsSchema)({
        offset: NAKAFA_AGENT_SEARCH_WINDOW,
      })
    ).toThrow();
  });
});
