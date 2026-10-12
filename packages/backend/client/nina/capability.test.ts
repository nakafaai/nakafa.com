import { describe, expect, it } from "@effect/vitest";
import { CapabilityOutputSchema } from "@repo/backend/client/nina/capability";
import { Result, Schema } from "effect";

describe("the stored output of a capability", () => {
  it.each(["firecrawl", "google"])(
    "still reads a web search card that names %s as its provider, a field the card no longer has",
    (provider) => {
      // The history projection guards a stored result with `Schema.is`, and the
      // browser decodes it with `Schema.decodeUnknownResult`: both keep the
      // default parse options, which drop a key the schema does not name.
      const stored = {
        text: "Two sources answer the query.",
        artifacts: [
          {
            id: "search-1",
            type: "data-web-search",
            data: { provider, queries: ["limit"], sources: [], status: "done" },
          },
        ],
      };

      expect(Schema.is(CapabilityOutputSchema)(stored)).toBe(true);
      expect(
        Result.getOrThrow(
          Schema.decodeUnknownResult(CapabilityOutputSchema)(stored)
        )
      ).toEqual({
        text: "Two sources answer the query.",
        artifacts: [
          {
            id: "search-1",
            type: "data-web-search",
            data: { queries: ["limit"], sources: [], status: "done" },
          },
        ],
      });
    }
  );
});
