// @vitest-environment jsdom

import { describe, expect, it } from "@effect/vitest";
import { focusIsLost } from "@repo/design-system/lib/focus";

describe("focus", () => {
  it("knows when the focus has gone nowhere the learner chose, which is the body or the box that leaves", () => {
    const box = document.createElement("div");
    const inside = document.createElement("button");
    const elsewhere = document.createElement("button");
    box.append(inside);
    document.body.replaceChildren(box, elsewhere);

    inside.focus();
    expect(focusIsLost(box)).toBe(true);

    inside.blur();
    expect(focusIsLost(box)).toBe(true);

    elsewhere.focus();
    expect(focusIsLost(box)).toBe(false);
  });

  it("counts only the body as lost when no box leaves the page", () => {
    const elsewhere = document.createElement("button");
    document.body.replaceChildren(elsewhere);

    elsewhere.focus();
    expect(focusIsLost(null)).toBe(false);

    elsewhere.blur();
    expect(focusIsLost(null)).toBe(true);
  });
});
