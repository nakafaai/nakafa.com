import { describe, expect, it } from "@effect/vitest";
import { Selection } from "@repo/backend/confect/response/model";
import { Array as Arr, Exit, Schema } from "effect";

/** Reports whether one short answer carrying this reading decodes. */
function decodes(number: string) {
  return Exit.isSuccess(
    Schema.decodeExit(Selection)({
      kind: "short-answer",
      number,
      text: "typed",
    })
  );
}

describe("response/model", () => {
  it("keeps a reading only as a canonical decimal or an integer fraction", () => {
    const canonical = [
      "0",
      "-0.5",
      "10000000000000000",
      "0.0000000000000001",
      "3/4",
      "-6/8",
      "0/5",
    ];
    const other = [
      "",
      "1e+16",
      "1e-16",
      "0.50",
      "+1",
      ".5",
      "-0",
      "3/0",
      "3/-4",
      "03/4",
      "1.5/2",
    ];

    expect(Arr.filter(canonical, (reading) => !decodes(reading))).toEqual([]);
    expect(Arr.filter(other, decodes)).toEqual([]);
  });
});
