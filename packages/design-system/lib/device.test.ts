import {
  checkWebGL2Support,
  getDeviceInfoForAnalytics,
  getPowerPreference,
  isMobileDevice,
} from "@repo/design-system/lib/device";
import { afterEach, describe, expect, it, vi } from "vitest";

const IPHONE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)";
const MAC_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0";
const WINDOWS_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0";

const originalUserAgent = navigator.userAgent;
const originalHardwareConcurrency = navigator.hardwareConcurrency;

function setNavigatorProperty(
  property: "hardwareConcurrency" | "userAgent",
  value: number | string | undefined
): void {
  Object.defineProperty(navigator, property, {
    configurable: true,
    value,
    writable: true,
  });
}

function setNavigatorState(
  userAgent: string,
  hardwareConcurrency: number | undefined
): void {
  setNavigatorProperty("userAgent", userAgent);
  setNavigatorProperty("hardwareConcurrency", hardwareConcurrency);
}

afterEach(() => {
  vi.unstubAllGlobals();
  setNavigatorState(originalUserAgent, originalHardwareConcurrency);
});

describe("isMobileDevice", () => {
  const cases = [
    {
      expected: true,
      name: "identifies iPhone",
      userAgent: IPHONE_USER_AGENT,
    },
    {
      expected: true,
      name: "identifies Android",
      userAgent: "Mozilla/5.0 (Linux; Android 10; SM-G960F)",
    },
    {
      expected: true,
      name: "identifies iPad",
      userAgent: "Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X)",
    },
    {
      expected: true,
      name: "identifies webOS",
      userAgent: "Mozilla/5.0 (webOS/1.4; Tablet; LG-V505L) AppleWebKit/537.36",
    },
    {
      expected: true,
      name: "identifies BlackBerry",
      userAgent:
        "BlackBerry9700/5.0.0.313 Profile/MIDP-2.0 Configuration/CLDC-1.1",
    },
    {
      expected: false,
      name: "rejects desktop Chrome",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    {
      expected: false,
      name: "rejects desktop Firefox",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    },
    {
      expected: false,
      name: "rejects desktop Safari",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    },
  ];

  it.each(cases)("$name", ({ expected, userAgent }) => {
    setNavigatorProperty("userAgent", userAgent);

    expect(isMobileDevice()).toBe(expected);
  });
});

describe("checkWebGL2Support", () => {
  it("returns false when window is undefined", () => {
    vi.stubGlobal("window", undefined);

    expect(checkWebGL2Support()).toBe(false);
  });

  it("returns false when document is undefined", () => {
    vi.stubGlobal("document", undefined);

    expect(checkWebGL2Support()).toBe(false);
  });

  it("returns false when the WebGL2 context is unavailable", () => {
    vi.stubGlobal("document", {
      createElement: vi.fn().mockReturnValue({
        getContext: vi.fn().mockReturnValue(null),
      }),
    });

    expect(checkWebGL2Support()).toBe(false);
  });

  it("returns true when the WebGL2 context is available", () => {
    const getContext = vi.fn().mockReturnValue({ drawingBufferWidth: 800 });
    const createElement = vi.fn().mockReturnValue({ getContext });
    vi.stubGlobal("document", { createElement });

    expect(checkWebGL2Support()).toBe(true);
    expect(createElement).toHaveBeenCalledWith("canvas");
    expect(getContext).toHaveBeenCalledWith("webgl2");
  });

  it("returns false when canvas creation throws", () => {
    const createElement = vi.fn().mockImplementation(() => {
      throw new Error("Canvas not supported");
    });
    vi.stubGlobal("document", { createElement });

    expect(checkWebGL2Support()).toBe(false);
  });
});

describe("getPowerPreference", () => {
  const cases = [
    {
      cores: 8,
      expected: "default",
      name: "uses default for mobile devices regardless of core count",
      userAgent: IPHONE_USER_AGENT,
    },
    {
      cores: 2,
      expected: "default",
      name: "uses default for desktops with fewer than four cores",
      userAgent: WINDOWS_USER_AGENT,
    },
    {
      cores: 3,
      expected: "default",
      name: "uses default for desktops with exactly three cores",
      userAgent: WINDOWS_USER_AGENT,
    },
    {
      cores: 4,
      expected: "high-performance",
      name: "uses high-performance for desktops with exactly four cores",
      userAgent: WINDOWS_USER_AGENT,
    },
    {
      cores: 8,
      expected: "high-performance",
      name: "uses high-performance for desktops with eight cores",
      userAgent: MAC_USER_AGENT,
    },
    {
      cores: 16,
      expected: "high-performance",
      name: "uses high-performance for desktops with sixteen cores",
      userAgent: WINDOWS_USER_AGENT,
    },
    {
      cores: undefined,
      expected: "high-performance",
      name: "uses the four-core fallback when core count is unavailable",
      userAgent: WINDOWS_USER_AGENT,
    },
  ];

  it.each(cases)("$name", ({ cores, expected, userAgent }) => {
    setNavigatorState(userAgent, cores);

    expect(getPowerPreference()).toBe(expected);
  });
});

describe("getDeviceInfoForAnalytics", () => {
  const cases = [
    {
      cores: 6,
      expected: {
        cores: 6,
        isMobile: true,
        powerPreference: "default",
        userAgent: IPHONE_USER_AGENT,
      },
      name: "reports a mobile device",
      userAgent: IPHONE_USER_AGENT,
    },
    {
      cores: 8,
      expected: {
        cores: 8,
        isMobile: false,
        powerPreference: "high-performance",
        userAgent: WINDOWS_USER_AGENT,
      },
      name: "reports a desktop device",
      userAgent: WINDOWS_USER_AGENT,
    },
    {
      cores: 2,
      expected: {
        cores: 2,
        isMobile: true,
        powerPreference: "default",
        userAgent: IPHONE_USER_AGENT,
      },
      name: "reports default power preference for a low-end device",
      userAgent: IPHONE_USER_AGENT,
    },
    {
      cores: 16,
      expected: {
        cores: 16,
        isMobile: false,
        powerPreference: "high-performance",
        userAgent: MAC_USER_AGENT,
      },
      name: "reports high-performance preference for a high-end device",
      userAgent: MAC_USER_AGENT,
    },
    {
      cores: undefined,
      expected: {
        cores: 4,
        isMobile: false,
        powerPreference: "high-performance",
        userAgent: WINDOWS_USER_AGENT,
      },
      name: "reports the four-core fallback when core count is unavailable",
      userAgent: WINDOWS_USER_AGENT,
    },
  ];

  it.each(cases)("$name", ({ cores, expected, userAgent }) => {
    setNavigatorState(userAgent, cores);

    expect(getDeviceInfoForAnalytics()).toEqual(expected);
  });

  it("contains every analytics field", () => {
    setNavigatorState("Mozilla/5.0 Test Agent", 8);

    expect(Object.keys(getDeviceInfoForAnalytics())).toEqual([
      "isMobile",
      "cores",
      "powerPreference",
      "userAgent",
    ]);
  });
});
