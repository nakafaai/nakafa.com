import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { SearchInput } from "@/lib/nuqs/search";

const decode = (input: unknown) =>
  Effect.runSync(Schema.decodeUnknownEffect(SearchInput)(input));

describe("SearchInput", () => {
  it("reads the query of the URL", () => {
    expect(decode({ q: "algebra" })).toEqual({ q: "algebra" });
  });

  it("searches for nothing when the URL carries no query", () => {
    expect(decode({})).toEqual({ q: "" });
  });

  it("searches for nothing when the query is not one text", () => {
    expect(decode({ q: ["algebra", "physics"] })).toEqual({ q: "" });
  });
});
