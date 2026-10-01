import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  pickMultipleChoice,
  pickSingleChoice,
} from "@/components/tryout/runtime/response/pick";

const options = [
  { label: "Option 1", optionKey: "option-1", order: 1 },
  { label: "Option 2", optionKey: "option-2", order: 2 },
];
const single = { kind: "single-choice" as const, options };
const multiple = { kind: "multiple-choice" as const, options };

describe("try-out digit shortcuts", () => {
  it("selects the single-choice option at the digit's position", () => {
    expect(
      pickSingleChoice({ responseSpec: single, selection: null }, 1)
    ).toEqual(Option.some({ kind: "single-choice", optionKey: "option-2" }));
    expect(
      pickSingleChoice({ responseSpec: single, selection: null }, 4)
    ).toEqual(Option.none());
    expect(
      pickSingleChoice({ responseSpec: multiple, selection: null }, 0)
    ).toEqual(Option.none());
  });

  it("toggles the multiple-choice option at the digit's position", () => {
    const value = {
      responseSpec: multiple,
      selection: { kind: "multiple-choice" as const, optionKeys: ["option-1"] },
    };
    expect(pickMultipleChoice(value, 1)).toEqual(
      Option.some({
        kind: "multiple-choice",
        optionKeys: ["option-1", "option-2"],
      })
    );
    expect(pickMultipleChoice(value, 0)).toEqual(Option.some(null));
    expect(pickMultipleChoice(value, 2)).toEqual(Option.none());
    expect(
      pickMultipleChoice({ responseSpec: single, selection: null }, 0)
    ).toEqual(Option.none());
  });
});
