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

  it.each([
    [
      "0a7564382082ccc52179a832e50235b745409ae8b0432c43b4dc210cf3e66e45",
      "9fb47d599b419ceac2b77564a78e41818674022b9495e41dae4afd9ba8479fde",
    ],
    [
      "a0ba1ab3be661fb596614479bff8b12a3e34c5b9a0112d332a32bf5bc6456dcc",
      "48818ebaa1b88d2a50471dc7bd5279c1e5dc67cdfdfe9d7f73005b4f9ad44f31",
    ],
  ])("accepts production-frozen renderer transition %#", (legacy, signed) => {
    expect(
      matchesSignedTryoutContent(legacy, TryoutContentHashSchema.make(signed))
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
