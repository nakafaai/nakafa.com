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

  it.each([
    [
      "0344f7c24a33f8d58ce9d5d50493dfeed2aca8d3d1681120518916912c105b68",
      "66bd9dafd86b0bedde1323d91bc421a85f58afb118580205491fb1715502726d",
    ],
    [
      "9586425f8f8f8a6fb65cc53233832a0e05afb532c84f8e6e4d8ee3359aa0d795",
      "674ba9ede65b75d7ca52dce926ca44cbdc6cfd110d24dda305f9cd8b4b5f44fc",
    ],
    [
      "8c4af0d556c909fafb2b3761accc7b579e2fa177b66f90f77635891fa5c97f07",
      "0334a005978e452ac88394610d7047c3428c31c700fa595b765e2a8b3a90e43e",
    ],
    [
      "99a205fd39a00d30e6a2a19ca3b8021a85b5e5afeba7796a777d36d94ba31c73",
      "dc23862792cd99b78283ca91f963882513f8f3a8fa3b90fb022ba6cfe6546f51",
    ],
    [
      "ff4d45324bf4e1f929f7d3ee3f5ff1d33a858d9120dd5d77227027f9d0d7a1a5",
      "119eb26396ff60ba3b45903c7cf983029879e592b6475d8724cce059c637a443",
    ],
    [
      "1feb4f072b6ccb2ec5273f54af785430e821d5074f9e661b2fbbff8cc94ac468",
      "c1702975997982e17e1c1f46e5fe0f6a915db62582295c7df147beece782d2a4",
    ],
    [
      "41dd96e8e16e2c389362456dd7cb593807c3daac6b5ec6e6fcd1c83957d2087d",
      "7dfa8d886426ced5c5bd69cbbf854f807a7d95b87ad35f89ff191bb76792b917",
    ],
    [
      "7702204d61055b35d34e4e7c4677174d840a68da917318cd4fa88ea8a4a4e255",
      "264bee3aeeb695bbc1b9446294c561f3ce72c7234697bdb890a143f8e4eea85d",
    ],
    [
      "332d20242ce4ec374d8f3a33a1a44c8c682881d10f837928db54746645a951d1",
      "ce7adcd9d6e7328f4eef97860faa78b66fa3387025c9a15897db83412f3699c9",
    ],
    [
      "0d1f9d9d993610be71957d00194cd77ff53d927dbcd14b4824a4c9d74083e4ac",
      "c26bc55188c287e05c5e6f4efd0c25c92c63795cd24c21f265d7ac33409f0605",
    ],
  ])(
    "accepts source-audited production IRT transition %#",
    (legacy, signed) => {
      expect(
        matchesSignedTryoutContent(legacy, TryoutContentHashSchema.make(signed))
      ).toBe(true);
    }
  );

  it("rejects an unreviewed transition", () => {
    expect(
      matchesSignedTryoutContent(
        "eb48ea258ba2a9f546a460d992b65a6ba4efb27d8bc4838b2587f19682b31a26",
        TryoutContentHashSchema.make("f".repeat(64))
      )
    ).toBe(false);
  });
});
