import { describe, expect, it } from "@effect/vitest";
import {
  newChoiceAnswers,
  numericAnswers,
} from "@repo/backend/confect/exams/blank";
import {
  type NumberSetting,
  numberSettingOf,
  withNumber,
} from "@/components/tenant/exams/number";

/** A setting with no number yet, as a new numeric answer shows it. */
const BLANK: NumberSetting = {
  acceptsFractions: false,
  tolerance: "",
  toleranceKind: "exact",
  unit: "",
  value: "",
};

describe("numberSettingOf", () => {
  it("shows a numeric answer without a key as a blank, exact number with no unit", () => {
    expect(numberSettingOf(numericAnswers(), null)).toEqual(BLANK);
  });

  it("shows the key's number and tolerance, and the entry's fraction rule and unit", () => {
    const saved = withNumber(numericAnswers(), {
      acceptsFractions: true,
      tolerance: "0,01",
      toleranceKind: "absolute",
      unit: " cm ",
      value: "12,5",
    });
    expect(numberSettingOf(saved.answers, saved.key)).toEqual({
      acceptsFractions: true,
      tolerance: "0.01",
      toleranceKind: "absolute",
      unit: "cm",
      value: "12.5",
    });
  });
});

describe("withNumber", () => {
  it("keys the number the teacher typed, in any script and with either point, as the contract spells it", () => {
    expect(
      withNumber(numericAnswers(), { ...BLANK, value: "٠٫٧٥٠" }).key
    ).toEqual([{ interaction: "number", kind: "numericEntry", value: "0.75" }]);
    expect(
      withNumber(numericAnswers(), {
        ...BLANK,
        tolerance: "0.1",
        toleranceKind: "relative",
        value: "8",
      }).key
    ).toEqual([
      {
        interaction: "number",
        kind: "numericEntry",
        tolerance: { kind: "relative", value: "0.1" },
        value: "8",
      },
    ]);
  });

  it("holds no key while the number, or its tolerance, is no decimal the contract grades", () => {
    expect(withNumber(numericAnswers(), { ...BLANK, value: "tiga" }).key).toBe(
      null
    );
    expect(
      withNumber(numericAnswers(), {
        ...BLANK,
        tolerance: "sedikit",
        toleranceKind: "absolute",
        value: "3",
      }).key
    ).toBe(null);
    // A relative tolerance of one or more allows any answer, which the contract refuses.
    expect(
      withNumber(numericAnswers(), {
        ...BLANK,
        tolerance: "1",
        toleranceKind: "relative",
        value: "3",
      }).key
    ).toBe(null);
  });

  it("leaves a blank unit out of the entry, and every interaction that is no numeric entry as it is", () => {
    const [entry] = withNumber(numericAnswers(), {
      ...BLANK,
      unit: "  ",
    }).answers;
    expect(entry).toEqual({
      acceptsFractions: false,
      id: "number",
      kind: "numericEntry",
      label: "Answer",
    });
    expect(withNumber(newChoiceAnswers(), { ...BLANK, value: "3" })).toEqual({
      answers: newChoiceAnswers(),
      key: null,
    });
  });
});
