import { extractDomain } from "@repo/ai/lib/domain";
import { describe, expect, it } from "vitest";

describe("extractDomain", () => {
  it("extracts the registrable domain label from full and partial URLs", () => {
    expect(extractDomain("https://www.react.dev/reference/react")).toBe(
      "react"
    );
    expect(extractDomain("nextjs.org/docs")).toBe("nextjs");
  });

  it("returns an empty label for invalid or public-suffix-only values", () => {
    expect(extractDomain("not a url")).toBe("");
    expect(extractDomain("gov.uk")).toBe("");
  });
});
