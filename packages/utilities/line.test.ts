import { describe, expect, it } from "@effect/vitest";
import { isSingleLine } from "@repo/utilities/line";
import { Array as Arr, Effect, Schema } from "effect";

const SingleLine = Schema.String.check(isSingleLine);

describe("line", () => {
  it("accepts text on one line, whatever its script or punctuation", () => {
    const accepted = Arr.map(
      [
        "SMA Negeri 1 Jakarta",
        "Yayasan Harapan, Bangsa",
        "École d'été",
        "ご案内",
        "",
      ],
      (text) => Schema.is(SingleLine)(text)
    );

    expect(accepted).toEqual(Arr.replicate(true, 5));
  });

  it("refuses every way to end a line", () => {
    const accepted = Arr.map(
      [
        "Harapan\nBangsa",
        "Harapan\rBangsa",
        "Harapan\r\nBangsa",
        "Harapan\u0085Bangsa",
        "Harapan Bangsa",
        "Harapan Bangsa",
      ],
      (text) => Schema.is(SingleLine)(text)
    );

    expect(accepted).toEqual(Arr.replicate(false, 6));
  });

  it("refuses a control character that is no line break", () => {
    const accepted = Arr.map(
      ["Harapan\tBangsa", "Harapan\u0000Bangsa", "Harapan\u001bBangsa"],
      (text) => Schema.is(SingleLine)(text)
    );

    expect(accepted).toEqual(Arr.replicate(false, 3));
  });

  it.effect("says what it expected when it refuses a text", () =>
    Effect.gen(function* () {
      const error = yield* Schema.decodeEffect(SingleLine)("a\nb").pipe(
        Effect.flip
      );

      expect(error.message).toContain("Expected one line of text.");
    })
  );
});
