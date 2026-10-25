import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import { PrerenderedPagesJson } from "@/lib/static/prerender";

describe("prerendered page list", () => {
  it("round-trips the list of page paths through its file format", () => {
    const paths = ["/en", "/en/articles", "/id/try-out"];
    const text = Schema.encodeSync(PrerenderedPagesJson)(paths);

    expect(text).toBe('["/en","/en/articles","/id/try-out"]');
    expect(Schema.decodeSync(PrerenderedPagesJson)(text)).toEqual(paths);
  });

  it("rejects a file that is not a list of paths", () => {
    expect(() =>
      Schema.decodeSync(PrerenderedPagesJson)('{"path":"/en"}')
    ).toThrow();
  });
});
