import {
  getNakafaExerciseRouteNumber,
  getNakafaExerciseSetRef,
  getNakafaExerciseSetRoute,
} from "@repo/contents/_lib/agent/exercise/ref";
import { Option } from "effect";
import { describe, expect, it } from "vitest";

const exerciseSetRoute =
  "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2";
const exerciseSetContentId = `id/${exerciseSetRoute}`;
const exerciseQuestionContentId = `${exerciseSetContentId}/11`;

describe("Nakafa exercise refs", () => {
  it("resolves question-level refs to the parent exercise set", () => {
    const ref = getNakafaExerciseSetRef(exerciseQuestionContentId);

    if (Option.isNone(ref)) {
      throw new Error("Expected an exercise set ref.");
    }

    expect(ref.value.content_id).toBe(exerciseSetContentId);
  });

  it("keeps set-level refs unchanged and rejects non-exercise refs", () => {
    const exerciseSet = getNakafaExerciseSetRef(exerciseSetContentId);
    const invalidRef = getNakafaExerciseSetRef("not-a-content-ref");
    const quran = getNakafaExerciseSetRef("id/quran/1");

    if (Option.isNone(exerciseSet)) {
      throw new Error("Expected an exercise set ref.");
    }

    expect(exerciseSet.value.content_id).toBe(exerciseSetContentId);
    expect(Option.isNone(invalidRef)).toBe(true);
    expect(Option.isNone(quran)).toBe(true);
  });

  it("reads route-level exercise numbers without user-language parsing", () => {
    expect(getNakafaExerciseRouteNumber(`${exerciseSetRoute}/11`)).toBe(11);
    expect(getNakafaExerciseRouteNumber(exerciseSetRoute)).toBeNull();
    expect(getNakafaExerciseRouteNumber("")).toBeNull();
    expect(getNakafaExerciseRouteNumber(`${exerciseSetRoute}/01`)).toBeNull();
    expect(getNakafaExerciseSetRoute(`${exerciseSetRoute}/11`)).toBe(
      exerciseSetRoute
    );
  });
});
