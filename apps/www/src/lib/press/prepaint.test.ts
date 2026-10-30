import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  EARLY_PRESS_SCRIPT,
  PRESS_ATTRIBUTE,
  PRESSED_ATTRIBUTE,
} from "@/lib/press/prepaint";

// The page runs the script once, from its head, before any control exists.
new Function(EARLY_PRESS_SCRIPT)();

/** Draws a control that keeps an early press, with a label inside it, as the server would. */
function drawControl() {
  const control = document.createElement("button");
  control.setAttribute(PRESS_ATTRIBUTE, "");
  const label = document.createElement("span");
  label.textContent = "Ask Nina";
  control.append(label);
  document.body.append(control);
  return { control, label };
}

describe("EARLY_PRESS_SCRIPT", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("marks the control when its label takes the press", () => {
    const { control, label } = drawControl();
    label.click();
    expect(control.hasAttribute(PRESSED_ATTRIBUTE)).toBe(true);
  });

  it("marks nothing for a press outside such a control", () => {
    const { control } = drawControl();
    const other = document.createElement("button");
    document.body.append(other);
    other.click();
    expect(control.hasAttribute(PRESSED_ATTRIBUTE)).toBe(false);
    expect(other.hasAttribute(PRESSED_ATTRIBUTE)).toBe(false);
  });

  it("marks nothing for a press whose target is the document itself", () => {
    const { control } = drawControl();
    document.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(control.hasAttribute(PRESSED_ATTRIBUTE)).toBe(false);
  });
});
