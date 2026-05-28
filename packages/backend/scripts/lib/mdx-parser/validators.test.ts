import { describe, expect, it } from "@effect/vitest";
import {
  parseExerciseYear,
  validateArticleCategory,
  validateExercisesCategory,
  validateExercisesMaterial,
  validateExercisesType,
  validateGrade,
  validateLocale,
  validateMaterial,
  validateSubjectCategory,
} from "@repo/backend/scripts/lib/mdx-parser/validators";
import { Effect } from "effect";

describe("MDX path validators", () => {
  it.effect("accepts known content path segments", () =>
    Effect.gen(function* () {
      expect(yield* validateLocale("id", "file")).toBe("id");
      expect(yield* validateArticleCategory("politics", "file")).toBe(
        "politics"
      );
      expect(yield* validateSubjectCategory("high-school", "file")).toBe(
        "high-school"
      );
      expect(yield* validateGrade("10", "file")).toBe("10");
      expect(yield* validateMaterial("mathematics", "file")).toBe(
        "mathematics"
      );
      expect(yield* validateExercisesCategory("high-school", "file")).toBe(
        "high-school"
      );
      expect(yield* validateExercisesType("snbt", "file")).toBe("snbt");
      expect(yield* validateExercisesMaterial("mathematics", "file")).toBe(
        "mathematics"
      );
      expect(yield* parseExerciseYear(undefined, "file")).toBeUndefined();
      expect(yield* parseExerciseYear("2026", "file")).toBe(2026);
    })
  );

  it.effect.each([
    [() => Effect.exit(validateLocale("xx", "file")), "Invalid locale"],
    [
      () => Effect.exit(validateArticleCategory("wrong", "file")),
      "Invalid article category",
    ],
    [
      () => Effect.exit(validateSubjectCategory("wrong", "file")),
      "Invalid subject category",
    ],
    [() => Effect.exit(validateGrade("13", "file")), "Invalid grade"],
    [() => Effect.exit(validateMaterial("wrong", "file")), "Invalid material"],
    [
      () => Effect.exit(validateExercisesCategory("wrong", "file")),
      "Invalid exercises category",
    ],
    [
      () => Effect.exit(validateExercisesType("wrong", "file")),
      "Invalid exercises type",
    ],
    [
      () => Effect.exit(validateExercisesMaterial("wrong", "file")),
      "Invalid exercises material",
    ],
    [
      () => Effect.exit(parseExerciseYear("26", "file")),
      'Invalid exercise year "26" in file. Expected a 4-digit year segment.',
    ],
  ] as const)("rejects invalid content path segments", ([run, message]) =>
    Effect.gen(function* () {
      const exit = yield* run();

      expect(exit._tag).toBe("Failure");
      if (exit._tag === "Failure") {
        expect(exit.cause.toString()).toContain(message);
      }
    })
  );
});
