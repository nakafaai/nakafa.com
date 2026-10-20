// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import { TextSearchParam } from "@/lib/entry/search";

const Search = Schema.Struct({ intent: TextSearchParam });

describe("entry search parameters", () => {
  it("keeps a text value", () => {
    expect(Schema.decodeSync(Search)({ intent: "/en/home" })).toStrictEqual({
      intent: "/en/home",
    });
  });

  it("drops a value of another shape instead of failing the page", () => {
    expect(
      Schema.decodeUnknownSync(Search)({ intent: ["/en/home", "/id/home"] })
    ).toStrictEqual({});
  });

  it("leaves an absent parameter absent", () => {
    expect(Schema.decodeSync(Search)({})).toStrictEqual({});
  });
});
