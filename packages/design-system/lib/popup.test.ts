import { afterEach, describe, expect, it } from "@effect/vitest";
import { keepClickOnTrigger } from "@repo/design-system/lib/popup";
import { MutableHashSet } from "effect";

afterEach(() => {
  document.body.replaceChildren();
});

/** A trigger that notes which pointers it captures, as a browser would hold them. */
function trigger() {
  const element = document.createElement("button");
  const captured = MutableHashSet.empty<number>();
  Object.assign(element, {
    hasPointerCapture: (id: number) => MutableHashSet.has(captured, id),
    releasePointerCapture: (id: number) => {
      MutableHashSet.remove(captured, id);
    },
    setPointerCapture: (id: number) => {
      MutableHashSet.add(captured, id);
    },
  });
  document.body.append(element);
  return element;
}

/** A pointer event of the given type, at the given point, from the given pointer. */
function pointer(type: string, id: number, x: number, y: number) {
  const event = new MouseEvent(type, { clientX: x, clientY: y });
  Object.defineProperty(event, "pointerId", { value: id });
  return event;
}

/** Presses the trigger with the given button and pointer type at (10, 10), as pointer 1, from a real input unless `isTrusted` is false. */
function press(
  element: HTMLButtonElement,
  button = 0,
  pointerType: "mouse" | "pen" | "touch" = "mouse",
  isTrusted = true
) {
  keepClickOnTrigger({
    button,
    isTrusted,
    clientX: 10,
    clientY: 10,
    currentTarget: element,
    pointerId: 1,
    pointerType,
  });
}

describe("keepClickOnTrigger", () => {
  it("captures a mouse press, so its release lands on the trigger", () => {
    const element = trigger();
    press(element);
    expect(element.hasPointerCapture(1)).toBe(true);
  });

  it("captures a pen press", () => {
    const element = trigger();
    press(element, 0, "pen");
    expect(element.hasPointerCapture(1)).toBe(true);
  });

  it("leaves a touch press and a press of another button alone", () => {
    const touched = trigger();
    press(touched, 0, "touch");
    const secondary = trigger();
    press(secondary, 2);
    expect(touched.hasPointerCapture(1)).toBe(false);
    expect(secondary.hasPointerCapture(1)).toBe(false);
  });

  it("leaves a press a script dispatched alone", () => {
    const element = trigger();
    press(element, 0, "mouse", false);
    expect(element.hasPointerCapture(1)).toBe(false);
  });

  it("holds the pointer while it stays within a click's travel", () => {
    const element = trigger();
    press(element);
    element.dispatchEvent(pointer("pointermove", 1, 13, 10));
    expect(element.hasPointerCapture(1)).toBe(true);
  });

  it("ignores another pointer's travel", () => {
    const element = trigger();
    press(element);
    element.dispatchEvent(pointer("pointermove", 2, 80, 80));
    expect(element.hasPointerCapture(1)).toBe(true);
  });

  it("lets the pointer go once it travels further, so a drag reaches an item", () => {
    const element = trigger();
    press(element);
    element.dispatchEvent(pointer("pointermove", 1, 15, 10));
    expect(element.hasPointerCapture(1)).toBe(false);
    element.setPointerCapture(1);
    element.dispatchEvent(pointer("pointermove", 1, 40, 10));
    expect(element.hasPointerCapture(1)).toBe(true);
  });

  it("stops watching once the release ends the capture", () => {
    const element = trigger();
    press(element);
    element.dispatchEvent(pointer("lostpointercapture", 1, 10, 10));
    element.dispatchEvent(pointer("pointermove", 1, 40, 10));
    expect(element.hasPointerCapture(1)).toBe(true);
  });
});
