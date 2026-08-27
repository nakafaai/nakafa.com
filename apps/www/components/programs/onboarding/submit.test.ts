import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  submitOnboardingRole,
  submitOnboardingSelection,
} from "@/components/programs/onboarding/submit";

const validValue = {
  focusKey: "student-exam",
  interest: "exam-prep",
  programKey: "snbt",
  role: "student",
};

describe("components/programs/onboarding/submit", () => {
  it.effect("autosaves only the selected role on the role step", () =>
    Effect.gen(function* () {
      const roleValues: unknown[] = [];
      const result = yield* submitOnboardingRole({
        updateRole: (value) => {
          roleValues.push(value);
          return Promise.resolve();
        },
        value: {
          role: "parent",
        },
      });

      expect(result).toEqual({ status: "success" });
      expect(roleValues).toEqual([{ role: "parent" }]);
    })
  );

  it.effect("does not autosave when the role step value is invalid", () =>
    Effect.gen(function* () {
      const roleValues: unknown[] = [];
      const result = yield* submitOnboardingRole({
        updateRole: (value) => {
          roleValues.push(value);
          return Promise.resolve();
        },
        value: {
          role: "administrator",
        },
      });

      expect(result).toEqual({
        messageKey: "onboarding.invalid-selection",
        status: "error",
      });
      expect(roleValues).toEqual([]);
    })
  );

  it.effect("returns error state when role autosave fails", () =>
    Effect.gen(function* () {
      const result = yield* submitOnboardingRole({
        updateRole: () => Promise.reject(new Error("Role unavailable")),
        value: {
          role: "teacher",
        },
      });

      expect(result).toEqual({
        messageKey: "onboarding.save-error",
        status: "error",
      });
    })
  );

  it.effect(
    "returns success after the Convex role and selection mutations resolve",
    () =>
      Effect.gen(function* () {
        const selectedValues: unknown[] = [];
        const roleValues: unknown[] = [];
        const result = yield* submitOnboardingSelection({
          selectProgram: (value) => {
            selectedValues.push(value);
            return Promise.resolve();
          },
          updateRole: (value) => {
            roleValues.push(value);
            return Promise.resolve();
          },
          value: validValue,
        });

        expect(result).toEqual({ status: "success" });
        expect(roleValues).toEqual([{ role: "student" }]);
        expect(selectedValues).toEqual([
          {
            interest: "exam-prep",
            programKey: "snbt",
          },
        ]);
      })
  );

  it.effect("returns validation state without calling either mutation", () =>
    Effect.gen(function* () {
      const selectedValues: unknown[] = [];
      const roleValues: unknown[] = [];
      const result = yield* submitOnboardingSelection({
        selectProgram: (value) => {
          selectedValues.push(value);
          return Promise.resolve();
        },
        updateRole: (value) => {
          roleValues.push(value);
          return Promise.resolve();
        },
        value: {
          programKey: "snbt",
        },
      });

      expect(result).toEqual({
        messageKey: "onboarding.invalid-selection",
        status: "error",
      });
      expect(roleValues).toEqual([]);
      expect(selectedValues).toEqual([]);
    })
  );

  it.effect(
    "returns mutation error state when the Convex selection fails",
    () =>
      Effect.gen(function* () {
        const result = yield* submitOnboardingSelection({
          selectProgram: () => Promise.reject(new Error("Convex unavailable")),
          updateRole: () => Promise.resolve(),
          value: validValue,
        });

        expect(result).toEqual({
          messageKey: "onboarding.save-error",
          status: "error",
        });
      })
  );

  it.effect(
    "does not create a learning selection when the role mutation fails",
    () =>
      Effect.gen(function* () {
        const selectedValues: unknown[] = [];
        const result = yield* submitOnboardingSelection({
          selectProgram: (value) => {
            selectedValues.push(value);
            return Promise.resolve();
          },
          updateRole: () => Promise.reject(new Error("Role unavailable")),
          value: validValue,
        });

        expect(result).toEqual({
          messageKey: "onboarding.save-error",
          status: "error",
        });
        expect(selectedValues).toEqual([]);
      })
  );
});
