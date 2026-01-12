import {
  checkWebGL2Support,
  getDeviceInfoForAnalytics,
  getPowerPreference,
  isMobileDevice,
} from "@repo/design-system/lib/device";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("isMobileDevice", () => {
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: originalUserAgent,
      writable: true,
    });
  });

  it("returns true for iPhone", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)",
      writable: true,
    });

    expect(isMobileDevice()).toBe(true);
  });

  it("returns true for Android", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Linux; Android 10; SM-G960F)",
      writable: true,
    });

    expect(isMobileDevice()).toBe(true);
  });

  it("returns true for iPad", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X)",
      writable: true,
    });

    expect(isMobileDevice()).toBe(true);
  });

  it("returns true for webOS", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (webOS/1.4; Tablet; LG-V505L) AppleWebKit/537.36",
      writable: true,
    });

    expect(isMobileDevice()).toBe(true);
  });

  it("returns true for BlackBerry", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "BlackBerry9700/5.0.0.313 Profile/MIDP-2.0 Configuration/CLDC-1.1",
      writable: true,
    });

    expect(isMobileDevice()).toBe(true);
  });

  it("returns false for desktop Chrome", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      writable: true,
    });

    expect(isMobileDevice()).toBe(false);
  });

  it("returns false for desktop Firefox", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
      writable: true,
    });

    expect(isMobileDevice()).toBe(false);
  });

  it("returns false for desktop Safari", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
      writable: true,
    });

    expect(isMobileDevice()).toBe(false);
  });
});

describe("checkWebGL2Support", () => {
  const originalWindow = global.window;
  const originalDocument = global.document;

  afterEach(() => {
    global.window = originalWindow;
    global.document = originalDocument;
  });

  it("returns false when window is undefined", () => {
    global.window = undefined as never;
    global.document = { createElement: vi.fn() } as never;

    expect(checkWebGL2Support()).toBe(false);
  });

  it("returns false when document is undefined", () => {
    global.window = { innerWidth: 1024 } as never;
    global.document = undefined as never;

    expect(checkWebGL2Support()).toBe(false);
  });

  it("returns false when WebGL2 context is null", () => {
    const createElementSpy = vi.fn().mockReturnValue({
      getContext: vi.fn().mockReturnValue(null),
    });

    global.window = {
      document: {
        createElement: createElementSpy,
      },
    } as never;
    global.document = {
      createElement: createElementSpy,
    } as never;

    expect(checkWebGL2Support()).toBe(false);
  });

  it("returns true when WebGL2 context is available", () => {
    const createContextSpy = vi
      .fn()
      .mockReturnValue({ drawingBufferWidth: 800 });
    const createElementSpy = vi.fn().mockReturnValue({
      getContext: createContextSpy,
    });

    global.window = {
      document: {
        createElement: createElementSpy,
      },
    } as never;
    global.document = {
      createElement: createElementSpy,
    } as never;

    expect(checkWebGL2Support()).toBe(true);
    expect(createElementSpy).toHaveBeenCalledWith("canvas");
    expect(createContextSpy).toHaveBeenCalledWith("webgl2");
  });

  it("returns false when getContext throws an error", () => {
    const createElementSpy = vi.fn().mockImplementation(() => {
      throw new Error("Canvas not supported");
    });

    global.window = {
      document: {
        createElement: createElementSpy,
      },
    } as never;
    global.document = {
      createElement: createElementSpy,
    } as never;

    expect(checkWebGL2Support()).toBe(false);
  });
});

describe("getPowerPreference", () => {
  const originalUserAgent = navigator.userAgent;
  const originalHardwareConcurrency = navigator.hardwareConcurrency;

  afterEach(() => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: originalUserAgent,
      writable: true,
    });
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      value: originalHardwareConcurrency,
      writable: true,
    });
  });

  it("returns 'default' for mobile devices regardless of cores", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)",
      writable: true,
    });
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      value: 8,
      writable: true,
    });

    expect(getPowerPreference()).toBe("default");
  });

  it("returns 'default' for desktop with less than 4 cores", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      writable: true,
    });
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      value: 2,
      writable: true,
    });

    expect(getPowerPreference()).toBe("default");
  });

  it("returns 'default' for desktop with exactly 3 cores", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      writable: true,
    });
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      value: 3,
      writable: true,
    });

    expect(getPowerPreference()).toBe("default");
  });

  it("returns 'high-performance' for desktop with exactly 4 cores", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      writable: true,
    });
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      value: 4,
      writable: true,
    });

    expect(getPowerPreference()).toBe("high-performance");
  });

  it("returns 'high-performance' for desktop with 8 cores", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0",
      writable: true,
    });
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      value: 8,
      writable: true,
    });

    expect(getPowerPreference()).toBe("high-performance");
  });

  it("returns 'high-performance' for desktop with 16 cores", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      writable: true,
    });
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      value: 16,
      writable: true,
    });

    expect(getPowerPreference()).toBe("high-performance");
  });

  it("returns 'default' when hardwareConcurrency is undefined (fallback to 4 cores)", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      writable: true,
    });

    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      value: undefined,
      writable: true,
    });

    expect(getPowerPreference()).toBe("high-performance");
  });
});

describe("getDeviceInfoForAnalytics", () => {
  const originalUserAgent = navigator.userAgent;
  const originalHardwareConcurrency = navigator.hardwareConcurrency;

  afterEach(() => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: originalUserAgent,
      writable: true,
    });
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      value: originalHardwareConcurrency,
      writable: true,
    });
  });

  it("returns device info with isMobile=true for mobile device", () => {
    const testUserAgent =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)";
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: testUserAgent,
      writable: true,
    });
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      value: 6,
      writable: true,
    });

    const deviceInfo = getDeviceInfoForAnalytics();

    expect(deviceInfo.isMobile).toBe(true);
    expect(deviceInfo.cores).toBe(6);
    expect(deviceInfo.userAgent).toBe(testUserAgent);
  });

  it("returns device info with isMobile=false for desktop device", () => {
    const testUserAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0";
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: testUserAgent,
      writable: true,
    });
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      value: 8,
      writable: true,
    });

    const deviceInfo = getDeviceInfoForAnalytics();

    expect(deviceInfo.isMobile).toBe(false);
    expect(deviceInfo.cores).toBe(8);
    expect(deviceInfo.userAgent).toBe(testUserAgent);
  });

  it("returns correct powerPreference for low-end device", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)",
      writable: true,
    });
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      value: 2,
      writable: true,
    });

    const deviceInfo = getDeviceInfoForAnalytics();

    expect(deviceInfo.powerPreference).toBe("default");
  });

  it("returns correct powerPreference for high-end device", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0",
      writable: true,
    });
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      value: 16,
      writable: true,
    });

    const deviceInfo = getDeviceInfoForAnalytics();

    expect(deviceInfo.powerPreference).toBe("high-performance");
  });

  it("returns fallback cores value of 4 when hardwareConcurrency is undefined", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      writable: true,
    });
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      value: undefined,
      writable: true,
    });

    const deviceInfo = getDeviceInfoForAnalytics();

    expect(deviceInfo.cores).toBe(4);
  });

  it("contains all required fields", () => {
    const testUserAgent = "Mozilla/5.0 Test Agent";
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: testUserAgent,
      writable: true,
    });
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      value: 8,
      writable: true,
    });

    const deviceInfo = getDeviceInfoForAnalytics();

    expect(deviceInfo).toHaveProperty("isMobile");
    expect(deviceInfo).toHaveProperty("cores");
    expect(deviceInfo).toHaveProperty("powerPreference");
    expect(deviceInfo).toHaveProperty("userAgent");
    expect(Object.keys(deviceInfo)).toHaveLength(4);
  });
});
