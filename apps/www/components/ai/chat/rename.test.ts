import { describe, expect, it } from "@effect/vitest";
import {
  focusBoxAfterRefusal,
  handleTitleKeyDown,
  returnFocusAfterClose,
} from "@/components/ai/chat/rename";

/** A key press of the box, as the browser dispatches it. */
function press(key: string, init: KeyboardEventInit = {}) {
  return new KeyboardEvent("keydown", { cancelable: true, key, ...init });
}

/** A page with the box, the chat's menu, the title and a control the learner chose. */
function fixture() {
  const box = document.createElement("input");
  const menu = document.createElement("button");
  const title = document.createElement("h1");
  const learner = document.createElement("button");
  title.tabIndex = -1;
  document.body.replaceChildren(box, menu, title, learner);
  return { box, learner, menu, title };
}

describe("chat rename keys", () => {
  it("saves on Enter and consumes that key press, so it does not also reach the control that takes the focus", () => {
    const save = vi.fn();
    const close = vi.fn();
    const event = press("Enter");

    handleTitleKeyDown(event, { close, save });

    expect(save).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves an Enter that ends a composed character to the keyboard", () => {
    const save = vi.fn();
    const event = press("Enter", { isComposing: true });

    handleTitleKeyDown(event, { close: vi.fn(), save });

    expect(save).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("closes on Escape without saving", () => {
    const save = vi.fn();
    const close = vi.fn();
    const event = press("Escape");

    handleTitleKeyDown(event, { close, save });

    expect(close).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("leaves an Escape that cancels a composed character to the keyboard, so the box stays open", () => {
    const close = vi.fn();

    handleTitleKeyDown(press("Escape", { isComposing: true }), {
      close,
      save: vi.fn(),
    });

    expect(close).not.toHaveBeenCalled();
  });

  it("leaves the Escape that Safari sends after a composed character has ended to the keyboard", () => {
    const close = vi.fn();

    handleTitleKeyDown(press("Escape", { keyCode: 229 }), {
      close,
      save: vi.fn(),
    });

    expect(close).not.toHaveBeenCalled();
  });
});

describe("chat rename focus", () => {
  it("returns the focus to the control that opened the box while the box holds it", () => {
    const { box, menu, title } = fixture();
    box.focus();

    returnFocusAfterClose(box, menu, title);

    expect(document.activeElement).toBe(menu);
  });

  it("keeps the focus a learner chose when the box closes", () => {
    const { box, learner, menu, title } = fixture();
    learner.focus();

    returnFocusAfterClose(box, menu, title);

    expect(document.activeElement).toBe(learner);
  });

  it("gives the focus to the title when the control that opened the box is gone", () => {
    const { box, title } = fixture();
    box.focus();

    returnFocusAfterClose(box, null, title);

    expect(document.activeElement).toBe(title);
  });

  it("gives the box the focus after a refused save while the focus is lost", () => {
    const { box, menu } = fixture();

    focusBoxAfterRefusal(box, menu);

    expect(document.activeElement).toBe(box);
  });

  it("gives the box the focus after a refused save that left the focus on the chat's menu", () => {
    const { box, menu } = fixture();
    menu.focus();

    focusBoxAfterRefusal(box, menu);

    expect(document.activeElement).toBe(box);
  });

  it("keeps the focus a learner chose when a refused save brings the box back", () => {
    const { box, learner, menu } = fixture();
    learner.focus();

    focusBoxAfterRefusal(box, menu);

    expect(document.activeElement).toBe(learner);
  });
});
