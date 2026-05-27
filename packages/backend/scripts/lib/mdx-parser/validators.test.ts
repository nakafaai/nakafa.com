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
import { describe, expect, it } from "vitest";

/** Runs an invalid validator effect without preserving its success type. */
const runInvalidValidator = <A, E>(effect: Effect.Effect<A, E, never>) =>
  Effect.runPromiseExit(effect);

describe("MDX path validators", () => {
  it("accepts known content path segments", async () => {
    await expect(Effect.runPromise(validateLocale("id", "file"))).resolves.toBe(
      "id"
    );
    await expect(
      Effect.runPromise(validateArticleCategory("politics", "file"))
    ).resolves.toBe("politics");
    await expect(
      Effect.runPromise(validateSubjectCategory("high-school", "file"))
    ).resolves.toBe("high-school");
    await expect(Effect.runPromise(validateGrade("10", "file"))).resolves.toBe(
      "10"
    );
    await expect(
      Effect.runPromise(validateMaterial("mathematics", "file"))
    ).resolves.toBe("mathematics");
    await expect(
      Effect.runPromise(validateExercisesCategory("high-school", "file"))
    ).resolves.toBe("high-school");
    await expect(
      Effect.runPromise(validateExercisesType("snbt", "file"))
    ).resolves.toBe("snbt");
    await expect(
      Effect.runPromise(validateExercisesMaterial("mathematics", "file"))
    ).resolves.toBe("mathematics");
    await expect(
      Effect.runPromise(parseExerciseYear(undefined, "file"))
    ).resolves.toBeUndefined();
    await expect(
      Effect.runPromise(parseExerciseYear("2026", "file"))
    ).resolves.toBe(2026);
  });

  it.each([
    [() => runInvalidValidator(validateLocale("xx", "file")), "Invalid locale"],
    [
      () => runInvalidValidator(validateArticleCategory("wrong", "file")),
      "Invalid article category",
    ],
    [
      () => runInvalidValidator(validateSubjectCategory("wrong", "file")),
      "Invalid subject category",
    ],
    [() => runInvalidValidator(validateGrade("13", "file")), "Invalid grade"],
    [
      () => runInvalidValidator(validateMaterial("wrong", "file")),
      "Invalid material",
    ],
    [
      () => runInvalidValidator(validateExercisesCategory("wrong", "file")),
      "Invalid exercises category",
    ],
    [
      () => runInvalidValidator(validateExercisesType("wrong", "file")),
      "Invalid exercises type",
    ],
    [
      () => runInvalidValidator(validateExercisesMaterial("wrong", "file")),
      "Invalid exercises material",
    ],
    [
      () => runInvalidValidator(parseExerciseYear("26", "file")),
      'Invalid exercise year "26" in file. Expected a 4-digit year segment.',
    ],
  ])("rejects invalid content path segments", async (run, message) => {
    const exit = await run();

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      expect(exit.cause.toString()).toContain(message);
    }
  });
});
