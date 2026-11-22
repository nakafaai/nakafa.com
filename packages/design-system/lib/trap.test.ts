import { afterEach, describe, expect, it } from "@effect/vitest";
import { keepTabInside } from "@repo/design-system/lib/trap";

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

/** The parts of the key event React hands the popup's handler, for a key pressed in the popup. */
function keyOn(popup: HTMLElement, key: string, defaultPrevented = false) {
  return { currentTarget: popup, defaultPrevented, key };
}

describe("keepTabInside", () => {
  it("takes the focus back when a Tab drops it on the body, as Safari's order does past its last field", () => {
    const { field, popup } = popupWithField();
    field.focus();

    keepTabInside(keyOn(popup, "Tab"));
    field.blur();

    expect(document.activeElement).toBe(popup);
  });

  it("leaves a focus that a Tab moved within the popup or out to the page", () => {
    const { field, outside, popup } = popupWithField();
    popup.focus();

    keepTabInside(keyOn(popup, "Tab"));
    field.focus();
    expect(document.activeElement).toBe(field);

    keepTabInside(keyOn(popup, "Tab"));
    outside.focus();
    expect(document.activeElement).toBe(outside);
  });

  it("leaves a popup that left the page as the Tab closed it", () => {
    const { field, popup } = popupWithField();
    field.focus();

    keepTabInside(keyOn(popup, "Tab"));
    popup.remove();
    popup.dispatchEvent(new FocusEvent("focusout", { relatedTarget: null }));

    expect(document.activeElement).not.toBe(popup);
  });

  it("watches only the focus move of its own Tab", () => {
    const { field, popup } = popupWithField();
    popup.focus();

    keepTabInside(keyOn(popup, "Tab"));
    field.focus();
    field.blur();

    expect(document.activeElement).toBe(document.body);
  });

  it("ignores other keys and a Tab the trap already handled", () => {
    const { field, popup } = popupWithField();
    field.focus();

    keepTabInside(keyOn(popup, "Enter"));
    keepTabInside(keyOn(popup, "Tab", true));
    field.blur();

    expect(document.activeElement).toBe(document.body);
  });
});
