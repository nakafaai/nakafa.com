import {
  getExerciseSearchDescription,
  getExerciseSearchText,
  getExerciseSearchTitle,
  getExerciseSetSearchDescription,
  getExerciseSetSearchText,
  getExerciseSetSearchTitle,
} from "@repo/contents/_lib/exercises/search";
import { describe, expect, it } from "vitest";

describe("exercise search text", () => {
  it("includes localized labels and canonical slugs for agent retrieval", () => {
    const source = {
      answerBody: "Jawaban",
      category: "high-school",
      description: undefined,
      exerciseType: "try-out",
      exerciseTypeTitle: "Try Out 2026",
      locale: "id",
      material: "quantitative-knowledge",
      number: 11,
      questionBody: "Diberikan fungsi tangga.",
      setName: "set-2",
      setTitle: "Set 2",
      title: "Soal 11",
      type: "snbt",
      year: 2026,
    } as const;

    expect(getExerciseSearchTitle(source)).toBe(
      "SNBT Pengetahuan Kuantitatif Try Out 2026 Set 2 Soal 11"
    );
    expect(getExerciseSearchDescription(source)).toBe(
      "SMA SNBT Pengetahuan Kuantitatif Try Out 2026 Set 2 Nomor 11"
    );
    expect(getExerciseSearchText(source)).toContain("quantitative-knowledge");
    expect(getExerciseSearchText(source)).toContain("Pengetahuan Kuantitatif");
    expect(getExerciseSearchText(source)).toContain("try out");
    expect(getExerciseSearchText(source)).toContain("Try Out 2026");
  });

  it("builds set-level search text without forcing a question route", () => {
    const source = {
      category: "high-school",
      description: "Kumpulan latihan Pengetahuan Kuantitatif.",
      exerciseType: "try-out",
      exerciseTypeTitle: "Try Out 2026",
      locale: "id",
      material: "quantitative-knowledge",
      questionCount: 20,
      setName: "set-2",
      setTitle: "Set 2",
      type: "snbt",
      year: 2026,
    } as const;

    expect(getExerciseSetSearchTitle(source)).toBe(
      "SNBT Pengetahuan Kuantitatif Try Out 2026 Set 2"
    );
    expect(getExerciseSetSearchDescription(source)).toBe(
      "SMA SNBT Pengetahuan Kuantitatif Try Out 2026 Set 2 20 soal"
    );
    expect(getExerciseSetSearchText(source)).toContain("set 2");
    expect(getExerciseSetSearchText(source)).toContain("20 soal");
  });
});
