import { describe, expect, it } from "@effect/vitest";
import { isTyping } from "@/components/shared/typing";

describe("shared/typing", () => {
  it.each(["input", "select", "textarea"])("holds the keys in a %s", (tag) => {
    expect(isTyping(document.createElement(tag))).toBe(true);
  });

  it("holds the keys in editable text", () => {
    const editor = document.createElement("div");
    Object.defineProperty(editor, "isContentEditable", { value: true });

    expect(isTyping(editor)).toBe(true);
  });

  it("leaves the keys to the page anywhere else", () => {
    expect(isTyping(document.createElement("button"))).toBe(false);
    expect(isTyping(window)).toBe(false);
    expect(isTyping(null)).toBe(false);
  });
});
