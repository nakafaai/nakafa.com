import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  disposeWebGLRenderer,
  readDocumentHidden,
  readServerDocumentHidden,
  resolveFrameloop,
  resolveVisibleStage,
  subscribeToDocumentVisibility,
  subscribeToInert,
  watchContextLoss,
} from "@repo/design-system/components/three/host";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveVisibleStage", () => {
  it("keeps failed, drawn, and loading states distinct", () => {
    expect(resolveVisibleStage("failed", false)).toBe("failed");
    expect(resolveVisibleStage("failed", true)).toBe("failed");
    expect(resolveVisibleStage("drawn", true)).toBe("drawn");
    expect(resolveVisibleStage("drawn", false)).toBe("loading");
    expect(resolveVisibleStage("loading", false)).toBe("loading");
  });
});

describe("resolveFrameloop", () => {
  it("stops rendering when not running, runs natively when paced, and uses demand when still", () => {
    expect(resolveFrameloop(false, true)).toBe("never");
    expect(resolveFrameloop(false, false)).toBe("never");
    expect(resolveFrameloop(true, true)).toBe("always");
    expect(resolveFrameloop(true, false)).toBe("demand");
  });
});

describe("watchContextLoss", () => {
  it("calls preventDefault on webglcontextlost and ignores intentional losses", () => {
    const element = new EventTarget();
    let intentional = false;
    const onLost = vi.fn();
    const onRestored = vi.fn();

    const stop = watchContextLoss(
      { domElement: element },
      {
        isIntentional: () => intentional,
        onLost,
        onRestored,
      }
    );

    const unexpected = new Event("webglcontextlost", { cancelable: true });
    element.dispatchEvent(unexpected);
    expect(unexpected.defaultPrevented).toBe(true);
    expect(onLost).toHaveBeenCalledTimes(1);

    intentional = true;
    const evicted = new Event("webglcontextlost", { cancelable: true });
    element.dispatchEvent(evicted);
    expect(evicted.defaultPrevented).toBe(true);
    expect(onLost).toHaveBeenCalledTimes(1);

    element.dispatchEvent(new Event("webglcontextrestored"));
    expect(onRestored).toHaveBeenCalledTimes(1);

    stop();
    intentional = false;
    element.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    element.dispatchEvent(new Event("webglcontextrestored"));
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(onRestored).toHaveBeenCalledTimes(1);
  });
});

describe("disposeWebGLRenderer", () => {
  it("disposes and forces context loss once, making later forceContextLoss calls a no-op", () => {
    const dispose = vi.fn();
    const forceContextLoss = vi.fn();
    const renderer = {
      dispose,
      forceContextLoss,
      getContext: () => ({ isContextLost: () => false }),
    };

    disposeWebGLRenderer(renderer);
    // Simulate R3F unmount calling forceContextLoss again on the disposed renderer.
    renderer.forceContextLoss();

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(forceContextLoss).toHaveBeenCalledTimes(1);
  });

  it("skips forceContextLoss when the context is already lost", () => {
    const dispose = vi.fn();
    const forceContextLoss = vi.fn();

    disposeWebGLRenderer({
      dispose,
      forceContextLoss,
      getContext: () => ({ isContextLost: () => true }),
    });

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(forceContextLoss).not.toHaveBeenCalled();
  });
});

describe("document subscriptions", () => {
  it("tracks visibilitychange listeners and inert mutation observers cleanly", () => {
    const onVisibility = vi.fn();
    const stopVisibility = subscribeToDocumentVisibility(onVisibility);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(onVisibility).toHaveBeenCalledTimes(1);
    stopVisibility();
    document.dispatchEvent(new Event("visibilitychange"));
    expect(onVisibility).toHaveBeenCalledTimes(1);

    expect(readDocumentHidden()).toBe(document.hidden);
    expect(readServerDocumentHidden()).toBe(false);

    const stopInert = subscribeToInert(vi.fn());
    stopInert();
  });
});
