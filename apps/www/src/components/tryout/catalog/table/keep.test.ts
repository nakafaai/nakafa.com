import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { keptSets } from "@/components/tryout/catalog/table/keep";
import type { TryoutSetRow } from "@/components/tryout/catalog/table/types";

/** A set of a track with only what the heads read. */
const set = (
  title: string,
  questionCount: number,
  minutes: number,
  publishedScore: number | null
) =>
  ({
    durationSeconds: minutes * 60,
    publishedScore,
    questionCount,
    title,
  }) as TryoutSetRow;

const rows = [
  set("Set One", 40, 60, 700),
  set("Set Two", 20, 30, null),
  set("Mock Three", 40, 45, 300),
];

const titles = (kept: readonly TryoutSetRow[]) =>
  Arr.map(kept, (row) => row.title);

describe("the rows the heads of a track keep", () => {
  it("keeps every row while no head holds a choice", () => {
    expect(keptSets(rows, {})).toEqual(rows);
    expect(keptSets(rows, { title: [], questionCount: [] })).toEqual(rows);
  });

  it("keeps the names that hold the words", () => {
    expect(titles(keptSets(rows, { title: ["set"] }))).toEqual([
      "Set One",
      "Set Two",
    ]);
  });

  it("keeps a range of questions, and of minutes as the column prints them", () => {
    expect(titles(keptSets(rows, { questionCount: ["30", ""] }))).toEqual([
      "Set One",
      "Mock Three",
    ]);
    expect(titles(keptSets(rows, { durationSeconds: ["", "45"] }))).toEqual([
      "Set Two",
      "Mock Three",
    ]);
  });

  it("keeps a range of scores, and drops a set without a score", () => {
    expect(titles(keptSets(rows, { publishedScore: ["0", ""] }))).toEqual([
      "Set One",
      "Mock Three",
    ]);
  });

  it("keeps the rows every head keeps", () => {
    expect(
      titles(
        keptSets(rows, {
          publishedScore: ["500", ""],
          questionCount: ["40", "40"],
        })
      )
    ).toEqual(["Set One"]);
  });
});
