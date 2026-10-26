// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "@effect/vitest";
import { typeIntoField } from "@repo/design-system/lib/arabic/type";

afterEach(() => {
  document.body.replaceChildren();
});

/** A text area on the page holding `value`, with its words from `start` to `end` selected. */
function fieldWith(value: string, start: number, end: number) {
  const field = document.createElement("textarea");
  document.body.append(field);
  field.value = value;
  field.setSelectionRange(start, end);
  return field;
}

describe("typing into a field", () => {
  it("puts the text at the caret and moves the caret past it", () => {
    const field = fieldWith("كتب", 1, 1);

    typeIntoField(field, "َ");

    expect(field.value).toBe("كَتب");
    expect(field.selectionStart).toBe(2);
    expect(field.selectionEnd).toBe(2);
  });

  it("replaces the selected words", () => {
    const field = fieldWith("Saya membaca buku", 13, 17);

    typeIntoField(field, "كتاب");

    expect(field.value).toBe("Saya membaca كتاب");
  });

  it("puts the text at the end of a field that reports no caret", () => {
    const field = fieldWith("Saya", 0, 0);
    Object.defineProperty(field, "selectionStart", { get: () => null });
    Object.defineProperty(field, "selectionEnd", { get: () => null });

    typeIntoField(field, " كتاب");

    expect(field.value).toBe("Saya كتاب");
  });

  it("tells the page with an input event that bubbles", () => {
    const field = fieldWith("", 0, 0);
    const typed: string[] = [];
    document.body.addEventListener("input", (event) => {
      if (event.target instanceof HTMLTextAreaElement) {
        typed.push(event.target.value);
      }
    });

    typeIntoField(field, "ب");

    expect(typed).toEqual(["ب"]);
  });
});
