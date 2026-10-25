import { afterEach, describe, expect, it } from "@effect/vitest";
import { warmWhenIdle } from "@/lib/idle";

/** Gives the window an idle callback that the test controls, and returns the stubs. */
function stubIdleCallback() {
  const requestIdleCallback = vi.fn((_callback: () => void) => 7);
  const cancelIdleCallback = vi.fn((_handle: number) => undefined);
  Object.defineProperty(window, "requestIdleCallback", {
    configurable: true,
    value: requestIdleCallback,
  });
  Object.defineProperty(window, "cancelIdleCallback", {
    configurable: true,
    value: cancelIdleCallback,
  });
  return { cancelIdleCallback, requestIdleCallback };
}

describe("warming in the idle time of the browser", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "requestIdleCallback");
    Reflect.deleteProperty(window, "cancelIdleCallback");
  });

  it("waits for the browser to be idle, and cancels the wait when the caller cancels", () => {
    const { cancelIdleCallback, requestIdleCallback } = stubIdleCallback();
    const warm = vi.fn();

    const cancel = warmWhenIdle(warm);
    expect(warm).not.toHaveBeenCalled();
    expect(requestIdleCallback).toHaveBeenCalledWith(warm);

    cancel?.();
    expect(cancelIdleCallback).toHaveBeenCalledWith(7);
  });

  it("warms at once, with nothing to cancel, where the browser has no idle callback", () => {
    const warm = vi.fn();

    const cancel = warmWhenIdle(warm);
    expect(warm).toHaveBeenCalledOnce();
    expect(cancel).toBeUndefined();
  });
});
