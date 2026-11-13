import { describe, expect, it } from "@effect/vitest";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import {
  decimalOf,
  type Entry,
  entryResponse,
  isEntry,
  reviewEntry,
} from "@/components/tryout/runtime/response/entry";

const SHORT: Entry = { id: "short", kind: "textEntry", label: "Answer" };

const SHORT_KEY: InteractionKey = {
  accepted: {
    acceptedAnswers: ["Jakarta", "DKI Jakarta"],
    collapseWhitespace: true,
    ignoreCase: true,
    kind: "text",
  },
  interaction: "short",
  kind: "textEntry",
};

const LENGTH: Entry = {
  acceptsFractions: false,
  id: "length",
  kind: "numericEntry",
  label: "Length",
  unit: "cm",
};

/** A count with no unit beside its field. */
const COUNT: Entry = {
  acceptsFractions: false,
  id: "length",
  kind: "numericEntry",
  label: "Count",
};

const LENGTH_KEY: InteractionKey = {
  interaction: "length",
  kind: "numericEntry",
  value: "12.5",
};

const CHOICE: Interaction = {
  id: "choice",
  kind: "choice",
  label: "Choose",
  maxChoices: 1,
  minChoices: 1,
  options: [],
  shuffle: false,
};

describe("tryout/runtime/response/entry", () => {
  it("answers a short answer and a numeric answer by typing, and nothing else", () => {
    expect(isEntry(SHORT)).toBe(true);
    expect(isEntry(LENGTH)).toBe(true);
    expect(isEntry(CHOICE)).toBe(false);
  });

  it("sends what the learner typed, and clears the answer once it is blank", () => {
    expect(entryResponse(" 12,5 ")).toEqual({ text: " 12,5 " });
    expect(entryResponse("   ")).toBeNull();
  });

  it("writes a number with the decimal point of the learner's language", () => {
    expect(decimalOf("id")).toBe(",");
    expect(decimalOf("de")).toBe(",");
    expect(decimalOf("en")).toBe(".");
  });

  it("marks a short answer by the key's accepted answers, wrong when none matches and open while blank", () => {
    const review = (text: string) =>
      reviewEntry({
        decimal: ",",
        entry: SHORT,
        key: SHORT_KEY,
        response: { text },
      });
    expect(review(" dki jakarta ")).toMatchObject({
      accepted: ["Jakarta", "DKI Jakarta"],
      blank: false,
      earned: true,
      tone: "correct",
    });
    expect(review("Bandung")).toMatchObject({ earned: false, tone: "wrong" });
    expect(
      reviewEntry({
        decimal: ",",
        entry: SHORT,
        key: SHORT_KEY,
        response: null,
      })
    ).toMatchObject({ blank: true, earned: false, text: "", tone: "idle" });
  });

  it("marks a number in any decimal point, and shows the key's number in the learner's language with its unit", () => {
    expect(
      reviewEntry({
        decimal: ",",
        entry: LENGTH,
        key: LENGTH_KEY,
        response: { text: "12,5" },
      })
    ).toMatchObject({ accepted: ["12,5 cm"], earned: true, tone: "correct" });
    expect(
      reviewEntry({
        decimal: ".",
        entry: COUNT,
        key: LENGTH_KEY,
        response: { text: "13" },
      })
    ).toMatchObject({ accepted: ["12.5"], earned: false, tone: "wrong" });
  });

  it("accepts nothing under a key of another kind", () => {
    expect(
      reviewEntry({
        decimal: ".",
        entry: SHORT,
        key: { correct: ["option-1"], interaction: "short", kind: "choice" },
        response: { text: "Jakarta" },
      })
    ).toMatchObject({ accepted: [], earned: false, tone: "wrong" });
  });
});
