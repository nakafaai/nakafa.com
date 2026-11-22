import { afterEach, describe, expect, it } from "@effect/vitest";
import { keepTabInside } from "@repo/design-system/lib/trap";
import type { KeyboardEvent } from "react";

afterEach(() => {
  document.body.replaceChildren();
});

/** A modal popup that can hold the focus, with a field inside it, and a button outside it. */
function popupWithField() {
  const popup = document.createElement("div");
  popup.tabIndex = -1;
  const field = document.createElement("input");
  popup.append(field);
  const outside = document.createElement("button");
  document.body.append(popup, outside);
  return { field, outside, popup };
}

/** The key event React hands the popup's handler, for a key pressed in the popup. */
function keyOn(popup: HTMLElement, key: string, defaultPrevented = false) {
  return {
    currentTarget: popup,
    defaultPrevented,
    key,
  } as unknown as KeyboardEvent<HTMLElement>;
}

/** Lets the microtask that checks the focus run. */
const settled = () => Promise.resolve();

describe("keepTabInside", () => {
  it("takes the focus back when a Tab drops it on the body, as Safari's order does past its last field", async () => {
    const { field, popup } = popupWithField();
    field.focus();

    keepTabInside(keyOn(popup, "Tab"));
    field.blur();
    await settled();

    expect(document.activeElement).toBe(popup);
  });

  it("leaves a focus that a Tab moved within the popup or out to the page", async () => {
    const { field, outside, popup } = popupWithField();
    popup.focus();

    keepTabInside(keyOn(popup, "Tab"));
    field.focus();
    await settled();
    expect(document.activeElement).toBe(field);

    keepTabInside(keyOn(popup, "Tab"));
    outside.focus();
    await settled();
    expect(document.activeElement).toBe(outside);
  });

  it("leaves a popup that left the page as the Tab closed it", async () => {
    const { field, popup } = popupWithField();
    field.focus();

    keepTabInside(keyOn(popup, "Tab"));
    popup.remove();
    await settled();

    expect(document.activeElement).toBe(document.body);
  });

  it("watches only the focus move of its own Tab", async () => {
    const { field, popup } = popupWithField();
    popup.focus();

    keepTabInside(keyOn(popup, "Tab"));
    field.focus();
    await settled();
    field.blur();
    await settled();

    expect(document.activeElement).toBe(document.body);
  });

  it("ignores other keys and a Tab the trap already handled", async () => {
    const { field, popup } = popupWithField();
    field.focus();

    keepTabInside(keyOn(popup, "Enter"));
    keepTabInside(keyOn(popup, "Tab", true));
    field.blur();
    await settled();

    expect(document.activeElement).toBe(document.body);
  });
});
