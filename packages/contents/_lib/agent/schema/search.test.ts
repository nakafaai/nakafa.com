import { NakafaAgentSearchOptionsSchema } from "@repo/contents/_lib/agent/schema/search";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("NakafaAgentSearchOptionsSchema", () => {
  it("applies the documented search defaults", () => {
    expect(
      Schema.decodeUnknownSync(NakafaAgentSearchOptionsSchema)({})
    ).toEqual({
      limit: 20,
      locale: "en",
      offset: 0,
    });
  });

  it("accepts the advertised continuation with the default page size", () => {
    expect(
      Schema.decodeUnknownSync(NakafaAgentSearchOptionsSchema)({ offset: 20 })
    ).toEqual({
      limit: 20,
      locale: "en",
      offset: 20,
    });
  });
});
