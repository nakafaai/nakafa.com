import { describe, expect, it } from "@effect/vitest";
import { handleTitleKeyDown } from "@/components/ai/chat/rename";

/** A key press of the box, as the browser dispatches it. */
function press(key: string, init: KeyboardEventInit = {}) {
  return new KeyboardEvent("keydown", { cancelable: true, key, ...init });
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
});
