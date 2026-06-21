import { describe, expect, it } from "vitest";
import { readExercisePreviewHref } from "@/components/ai/message-part/nakafa/exercise/link";

describe("readExercisePreviewHref", () => {
  it("appends localized question leaves for set-level previews", () => {
    expect(
      readExercisePreviewHref({
        locale: "id",
        number: 9,
        url: "https://nakafa.com/id/latihan/snbt/pengetahuan-kuantitatif/tryout-2026/set-1",
      })
    ).toBe(
      "https://nakafa.com/id/latihan/snbt/pengetahuan-kuantitatif/tryout-2026/set-1/soal-9"
    );
  });

  it("keeps concrete question preview URLs unchanged", () => {
    expect(
      readExercisePreviewHref({
        exerciseNumber: 9,
        locale: "en",
        number: 9,
        url: "https://nakafa.com/en/practice/snbt/quantitative-knowledge/tryout-2026/set-1/question-9",
      })
    ).toBe(
      "https://nakafa.com/en/practice/snbt/quantitative-knowledge/tryout-2026/set-1/question-9"
    );
  });
});
