import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  submitOnboardingRole,
  submitOnboardingSelection,
} from "@/components/programs/onboarding/submit";

const validValue = {
  focusKey: "student-exam",
  interests: ["school-curriculum", "exam-prep"],
  primaryProgramKey: "snbt",
  role: "student",
};

describe("components/programs/onboarding/submit", () => {
  it("autosaves only the selected role on the role step", async () => {
    const roleValues: unknown[] = [];
    const result = await Effect.runPromise(
      submitOnboardingRole({
        updateRole: (value) => {
          roleValues.push(value);
          return Promise.resolve();
        },
        value: {
          role: "parent",
        },
      })
    );

    expect(result).toEqual({ status: "success" });
    expect(roleValues).toEqual([{ role: "parent" }]);
  });

  it("does not autosave when the role step value is invalid", async () => {
    const roleValues: unknown[] = [];
    const result = await Effect.runPromise(
      submitOnboardingRole({
        updateRole: (value) => {
          roleValues.push(value);
          return Promise.resolve();
        },
        value: {
          role: "administrator",
        },
      })
    );

    expect(result).toEqual({
      messageKey: "onboarding.invalid-selection",
      status: "error",
    });
    expect(roleValues).toEqual([]);
  });

  it("returns error state when role autosave fails", async () => {
    const result = await Effect.runPromise(
      submitOnboardingRole({
        updateRole: () => Promise.reject(new Error("Role unavailable")),
        value: {
          role: "teacher",
        },
      })
    );

    expect(result).toEqual({
      messageKey: "onboarding.save-error",
      status: "error",
    });
  });

  it("returns success after the Convex role and selection mutations resolve", async () => {
    const selectedValues: unknown[] = [];
    const roleValues: unknown[] = [];
    const result = await Effect.runPromise(
      submitOnboardingSelection({
        selectProgram: (value) => {
          selectedValues.push(value);
          return Promise.resolve();
        },
        updateRole: (value) => {
          roleValues.push(value);
          return Promise.resolve();
        },
        value: validValue,
      })
    );

    expect(result).toEqual({ status: "success" });
    expect(roleValues).toEqual([{ role: "student" }]);
    expect(selectedValues).toEqual([
      {
        interests: ["school-curriculum", "exam-prep"],
        primaryProgramKey: "snbt",
      },
    ]);
  });

  it("returns validation state without calling either mutation", async () => {
    const selectedValues: unknown[] = [];
    const roleValues: unknown[] = [];
    const result = await Effect.runPromise(
      submitOnboardingSelection({
        selectProgram: (value) => {
          selectedValues.push(value);
          return Promise.resolve();
        },
        updateRole: (value) => {
          roleValues.push(value);
          return Promise.resolve();
        },
        value: {
          primaryProgramKey: "snbt",
        },
      })
    );

    expect(result).toEqual({
      messageKey: "onboarding.invalid-selection",
      status: "error",
    });
    expect(roleValues).toEqual([]);
    expect(selectedValues).toEqual([]);
  });

  it("returns mutation error state when the Convex selection fails", async () => {
    const result = await Effect.runPromise(
      submitOnboardingSelection({
        selectProgram: () => Promise.reject(new Error("Convex unavailable")),
        updateRole: () => Promise.resolve(),
        value: validValue,
      })
    );

    expect(result).toEqual({
      messageKey: "onboarding.save-error",
      status: "error",
    });
  });

  it("does not create a learning profile when the role mutation fails", async () => {
    const selectedValues: unknown[] = [];
    const result = await Effect.runPromise(
      submitOnboardingSelection({
        selectProgram: (value) => {
          selectedValues.push(value);
          return Promise.resolve();
        },
        updateRole: () => Promise.reject(new Error("Role unavailable")),
        value: validValue,
      })
    );

    expect(result).toEqual({
      messageKey: "onboarding.save-error",
      status: "error",
    });
    expect(selectedValues).toEqual([]);
  });
});
