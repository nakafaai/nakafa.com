import { describe, expect, it } from "@effect/vitest";
import { summarize } from "@repo/backend/scripts/knowledge/report";
import { Array as Arr } from "effect";

const questions = Arr.map(["Alpha", "Beta", "Gamma", "Delta"], (heading) => ({
  contentKey: `material/lesson/${heading}`,
  heading,
  ordinal: 1,
  question: `What is ${heading}?`,
}));

/** The verdict of a question whose section is stored under its heading, at a rank. */
const found = (heading: string, rank: number, milliseconds: number) => ({
  milliseconds,
  section: { heading, rank },
});

describe("model test report", () => {
  it("counts the questions whose section is within the top five, and how long they took", () => {
    expect(
      summarize("google/gemini-embedding-2", "id", questions, {
        kind: "ranked",
        pool: 3189,
        refused: 0,
        verdicts: [
          found("Alpha", 1, 100),
          found("Beta", 5, 200),
          found("Gamma", 6, 300),
          found("Delta", 20, 401),
        ],
      })
    ).toEqual({
      counted: 4,
      locale: "id",
      maxMs: 401,
      meanMs: 250,
      model: "google/gemini-embedding-2",
      pool: 3189,
      refused: 0,
      skipped: [],
      top5: 2,
      top5Share: 0.5,
    });
  });

  it("reports the sections that the model refused, and counts a question about one as missed", () => {
    // A section that the model refused ranks after the 3188 that it embedded.
    expect(
      summarize("google/gemini-embedding-001", "id", questions, {
        kind: "ranked",
        pool: 3188,
        refused: 1,
        verdicts: [
          found("Alpha", 1, 100),
          found("Beta", 3189, 200),
          found("Gamma", 2, 300),
          found("Delta", 4, 400),
        ],
      })
    ).toMatchObject({
      counted: 4,
      pool: 3188,
      refused: 1,
      skipped: [],
      top5: 3,
      top5Share: 0.75,
    });
  });

  it("leaves out a question whose label no longer fits the index, and says why", () => {
    const report = summarize("qwen/qwen3-embedding-8b", "de", questions, {
      kind: "ranked",
      pool: 10,
      refused: 0,
      verdicts: [
        { milliseconds: 10, section: null },
        found("Renamed", 1, 20),
        found("Gamma", 2, 30),
        found("Delta", 9, 40),
      ],
    });
    expect(report).toMatchObject({ counted: 2, top5: 1, top5Share: 0.5 });
    expect(report.skipped).toEqual([
      { question: "What is Alpha?", why: "no such section is stored" },
      { question: "What is Beta?", why: 'the stored heading is "Renamed"' },
    ]);
  });

  it("reports zero when nothing counted or nothing was timed", () => {
    expect(
      summarize("openai/text-embedding-3-small", "en", questions, {
        kind: "ranked",
        pool: 0,
        refused: 0,
        verdicts: [{ milliseconds: 12, section: null }],
      })
    ).toMatchObject({ counted: 0, meanMs: 12, top5: 0, top5Share: 0 });
    expect(
      summarize("openai/text-embedding-3-small", "en", [], {
        kind: "ranked",
        pool: 0,
        refused: 0,
        verdicts: [],
      })
    ).toMatchObject({ counted: 0, maxMs: 0, meanMs: 0, top5Share: 0 });
  });
});
