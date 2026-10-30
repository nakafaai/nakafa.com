import { describe, expect, it } from "@effect/vitest";
import { caretRect } from "@/components/tenant/classes/forum/caret";

/** A textarea on the page holding `value`, with the line height `lineHeight`. */
const fieldOf = (value: string, lineHeight: string) => {
  const field = document.createElement("textarea");
  field.value = value;
  field.style.setProperty("line-height", lineHeight);
  document.body.append(field);
  return field;
};

describe("caretRect", () => {
  it("measures the caret with a mirror that leaves the page, one line high", () => {
    const field = fieldOf("Halo @Rak", "24px");

    const rect = caretRect(field, 9);

    expect(rect).toMatchObject({ height: 24, width: 0 });
    expect(rect.bottom).toBe(rect.top + 24);
    expect(document.body.children).toHaveLength(1);
    field.remove();
  });

  it("takes the marker's own height when the line height is not a number", () => {
    const field = fieldOf("", "normal");

    expect(caretRect(field, 0)).toMatchObject({ width: 0, x: 0, y: 0 });
    field.remove();
  });
});
