import { TryoutContentHashSchema } from "@nakafa/aksara-contracts/tryout/spec";
import { describe, expect, it } from "vitest";
import { matchesSignedTryoutContent } from "./contentAttestation";

describe("try-out migration content attestation", () => {
  it("accepts byte-identical content", () => {
    const contentHash = TryoutContentHashSchema.make("a".repeat(64));
    expect(matchesSignedTryoutContent(contentHash, contentHash)).toBe(true);
  });

  it("accepts one exact source-audited transition", () => {
    expect(
      matchesSignedTryoutContent(
        "eb48ea258ba2a9f546a460d992b65a6ba4efb27d8bc4838b2587f19682b31a26",
        TryoutContentHashSchema.make(
          "967825c4c38f3b5706c5c4b62825548d928dde4ef41e70f1bd3b181b3908b808"
        )
      )
    ).toBe(true);
  });

  it("rejects an unreviewed transition", () => {
    expect(
      matchesSignedTryoutContent(
        "eb48ea258ba2a9f546a460d992b65a6ba4efb27d8bc4838b2587f19682b31a26",
        TryoutContentHashSchema.make("f".repeat(64))
      )
    ).toBe(false);
  });
});
