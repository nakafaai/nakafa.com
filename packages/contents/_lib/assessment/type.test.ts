import { getSubjects } from "@repo/contents/_lib/assessment/type";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("getSubjects", () => {
  it("derives SNBT materials from typed Material sources", async () => {
    expect(await Effect.runPromise(getSubjects("snbt"))).toEqual([
      { label: "quantitative-knowledge" },
      { label: "mathematical-reasoning" },
      { label: "general-reasoning" },
      { label: "indonesian-language" },
      { label: "english-language" },
      { label: "general-knowledge" },
      { label: "reading-and-writing-skills" },
    ]);
  });

  it("derives TKA materials from typed Material sources", async () => {
    expect(await Effect.runPromise(getSubjects("tka"))).toEqual([
      { label: "mathematics" },
    ]);
  });
});
