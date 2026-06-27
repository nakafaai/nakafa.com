// @vitest-environment node

import { describe, expect, it } from "vitest";
import { createSEOKeywords } from "@/lib/utils/seo/keywords";

describe("createSEOKeywords", () => {
  it("trims comma-separated keyword tokens", () => {
    expect(createSEOKeywords("math, algebra ,  practice ")).toEqual([
      "math",
      "algebra",
      "practice",
    ]);
  });

  it("drops empty keyword tokens", () => {
    expect(createSEOKeywords("Al-Fatihah, The Opening, ")).toEqual([
      "Al-Fatihah",
      "The Opening",
    ]);
  });
});
