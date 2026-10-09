import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  getPowerPreference,
  isMobileDevice,
} from "@repo/design-system/lib/device";

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

describe("hasHardwareWebGL", () => {
  type GetContext = (
    contextId: string,
    options: WebGLContextAttributes
  ) => unknown;

  /** The answer is remembered per module instance, so each case loads a fresh one. */
  async function loadDevice() {
    vi.resetModules();

    return await import("@repo/design-system/lib/device");
  }

  /** Makes the probe's canvas answer `getContext` with the given lookup. */
  function stubCanvas(getContext: GetContext) {
    vi.stubGlobal("document", {
      createElement: () => ({ getContext }),
    });
  }

  it("answers yes and releases the probe when the browser gives a WebGL2 context", async () => {
    const loseContext = vi.fn();
    const getContext = vi.fn<GetContext>(() => ({
      getExtension: () => ({ loseContext }),
    }));
    stubCanvas(getContext);

    const { hasHardwareWebGL } = await loadDevice();

    expect(hasHardwareWebGL()).toBe(true);
    expect(getContext).toHaveBeenCalledExactlyOnceWith("webgl2", {
      failIfMajorPerformanceCaveat: true,
    });
    expect(loseContext).toHaveBeenCalledOnce();
  });

  it("answers no when the browser gives no WebGL2 context", async () => {
    stubCanvas(vi.fn<GetContext>(() => null));

    const { hasHardwareWebGL } = await loadDevice();

    expect(hasHardwareWebGL()).toBe(false);
  });

  it("answers no when reading the WebGL2 context throws", async () => {
    stubCanvas(
      vi.fn<GetContext>(() => {
        throw new Error("WebGL is blocked.");
      })
    );

    const { hasHardwareWebGL } = await loadDevice();

    expect(hasHardwareWebGL()).toBe(false);
  });

  it("answers yes when the browser offers no context-loss extension", async () => {
    stubCanvas(vi.fn<GetContext>(() => ({ getExtension: () => null })));

    const { hasHardwareWebGL } = await loadDevice();

    expect(hasHardwareWebGL()).toBe(true);
  });

  it("asks the browser once and remembers a no answer", async () => {
    const getContext = vi.fn<GetContext>(() => null);
    stubCanvas(getContext);

    const { hasHardwareWebGL } = await loadDevice();

    expect(hasHardwareWebGL()).toBe(false);
    expect(hasHardwareWebGL()).toBe(false);
    expect(getContext).toHaveBeenCalledOnce();
  });
});
