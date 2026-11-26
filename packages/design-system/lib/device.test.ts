import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  DESKTOP_WEBGL_CONTEXT_LIMIT,
  getCanvasDpr,
  getMaxWebGLContexts,
  getPowerPreference,
  isLowEndDevice,
  isMobileDevice,
  isSoftwareRenderer,
  isWebGLAvailable,
  MOBILE_WEBGL_CONTEXT_LIMIT,
  shouldEnableAntialias,
  supportsHalfFloatColorBuffer,
} from "@repo/design-system/lib/device";

const IPHONE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)";
const IPAD_DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const MAC_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0";
const WINDOWS_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0";

const originalUserAgent = navigator.userAgent;
const originalHardwareConcurrency = navigator.hardwareConcurrency;
const originalMaxTouchPoints = navigator.maxTouchPoints;
const originalDeviceMemory: unknown = Reflect.get(navigator, "deviceMemory");
const originalDevicePixelRatio: unknown = Reflect.get(
  globalThis,
  "devicePixelRatio"
);
const originalWebGLRenderingContext: unknown = Reflect.get(
  globalThis,
  "WebGLRenderingContext"
);

function setNavigatorProperty(
  property:
    | "deviceMemory"
    | "hardwareConcurrency"
    | "maxTouchPoints"
    | "userAgent",
  value: unknown
): void {
  Object.defineProperty(navigator, property, {
    configurable: true,
    value,
    writable: true,
  });
}

function setGlobalProperty(property: string, value: unknown): void {
  Object.defineProperty(globalThis, property, {
    configurable: true,
    value,
    writable: true,
  });
}

function setDeviceProfile(options: {
  readonly cores?: number | undefined;
  readonly dpr?: number | undefined;
  readonly memory?: number | undefined;
  readonly touchPoints?: number | undefined;
  readonly userAgent?: string;
}): void {
  setNavigatorProperty("userAgent", options.userAgent ?? MAC_USER_AGENT);
  setNavigatorProperty(
    "hardwareConcurrency",
    "cores" in options ? options.cores : 8
  );
  setNavigatorProperty(
    "deviceMemory",
    "memory" in options ? options.memory : undefined
  );
  setNavigatorProperty("maxTouchPoints", options.touchPoints ?? 0);
  setGlobalProperty("devicePixelRatio", "dpr" in options ? options.dpr : 2);
}

afterEach(() => {
  vi.restoreAllMocks();
  setNavigatorProperty("userAgent", originalUserAgent);
  setNavigatorProperty("hardwareConcurrency", originalHardwareConcurrency);
  setNavigatorProperty("deviceMemory", originalDeviceMemory);
  setNavigatorProperty("maxTouchPoints", originalMaxTouchPoints);
  setGlobalProperty("devicePixelRatio", originalDevicePixelRatio);
  setGlobalProperty("WebGLRenderingContext", originalWebGLRenderingContext);
});

describe("isMobileDevice", () => {
  const cases = [
    {
      expected: true,
      name: "identifies iPhone",
      touchPoints: 5,
      userAgent: IPHONE_USER_AGENT,
    },
    {
      expected: true,
      name: "identifies Android",
      touchPoints: 5,
      userAgent: "Mozilla/5.0 (Linux; Android 10; SM-G960F)",
    },
    {
      expected: true,
      name: "identifies iPad",
      touchPoints: 5,
      userAgent: "Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X)",
    },
    {
      expected: true,
      name: "identifies iPadOS reporting desktop Macintosh UA with multi-touch",
      touchPoints: 5,
      userAgent: IPAD_DESKTOP_USER_AGENT,
    },
    {
      expected: true,
      name: "identifies webOS",
      touchPoints: 0,
      userAgent: "Mozilla/5.0 (webOS/1.4; Tablet; LG-V505L) AppleWebKit/537.36",
    },
    {
      expected: true,
      name: "identifies BlackBerry",
      touchPoints: 0,
      userAgent:
        "BlackBerry9700/5.0.0.313 Profile/MIDP-2.0 Configuration/CLDC-1.1",
    },
    {
      expected: false,
      name: "rejects desktop Chrome",
      touchPoints: 0,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    {
      expected: false,
      name: "rejects desktop Firefox",
      touchPoints: 0,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    },
    {
      expected: false,
      name: "rejects desktop Safari without multi-touch",
      touchPoints: 0,
      userAgent: IPAD_DESKTOP_USER_AGENT,
    },
  ];

  it.each(cases)("$name", ({ expected, touchPoints, userAgent }) => {
    setDeviceProfile({ touchPoints, userAgent });

    expect(isMobileDevice()).toBe(expected);
  });
});

describe("isLowEndDevice", () => {
  it("flags devices with 2 or fewer CPU cores", () => {
    setDeviceProfile({ cores: 2, memory: 8 });
    expect(isLowEndDevice()).toBe(true);
  });

  it("flags devices with 2 GB or less device memory", () => {
    setDeviceProfile({ cores: 8, memory: 2 });
    expect(isLowEndDevice()).toBe(true);
  });

  it("does not misclassify 4-core iOS privacy-capped devices as low-end", () => {
    setDeviceProfile({
      cores: 4,
      memory: undefined,
      userAgent: IPHONE_USER_AGENT,
    });
    expect(isLowEndDevice()).toBe(false);
  });

  it("leaves capable devices with >2 cores and >2 GB memory alone", () => {
    setDeviceProfile({ cores: 8, memory: 8 });
    expect(isLowEndDevice()).toBe(false);
  });

  it("treats missing core count and memory as non-low-end", () => {
    setDeviceProfile({ cores: undefined, memory: undefined });
    expect(isLowEndDevice()).toBe(false);
  });

  it("ignores non-positive or non-finite hardware metrics", () => {
    setDeviceProfile({ cores: 0, memory: Number.NaN });
    expect(isLowEndDevice()).toBe(false);
  });
});

describe("getPowerPreference", () => {
  const cases = [
    {
      cores: 8,
      expected: "default",
      memory: 8,
      name: "uses default for mobile devices regardless of core count",
      userAgent: IPHONE_USER_AGENT,
    },
    {
      cores: 8,
      expected: "default",
      memory: 4,
      name: "uses default for low-memory desktops",
      userAgent: WINDOWS_USER_AGENT,
    },
    {
      cores: 2,
      expected: "default",
      memory: undefined,
      name: "uses default for desktops with fewer than four cores",
      userAgent: WINDOWS_USER_AGENT,
    },
    {
      cores: 3,
      expected: "default",
      memory: undefined,
      name: "uses default for desktops with exactly three cores",
      userAgent: WINDOWS_USER_AGENT,
    },
    {
      cores: 4,
      expected: "high-performance",
      memory: undefined,
      name: "uses high-performance for desktops with exactly four cores",
      userAgent: WINDOWS_USER_AGENT,
    },
    {
      cores: 8,
      expected: "high-performance",
      memory: 8,
      name: "uses high-performance for desktops with eight cores",
      userAgent: MAC_USER_AGENT,
    },
    {
      cores: undefined,
      expected: "high-performance",
      memory: undefined,
      name: "uses the four-core fallback when core count is unavailable",
      userAgent: WINDOWS_USER_AGENT,
    },
  ];

  it.each(cases)("$name", ({ cores, expected, memory, userAgent }) => {
    setDeviceProfile({ cores, memory, userAgent });

    expect(getPowerPreference()).toBe(expected);
  });
});

describe("getCanvasDpr", () => {
  it("caps truly low-end canvases at 1.5x pixel ratio", () => {
    setDeviceProfile({ cores: 2, userAgent: IPHONE_USER_AGENT });
    expect(getCanvasDpr()).toEqual([1, 1.5]);
  });

  it("keeps capable mobile canvases at full 2x HD pixel ratio", () => {
    setDeviceProfile({ cores: 4, userAgent: IPHONE_USER_AGENT });
    expect(getCanvasDpr()).toEqual([1, 2]);
  });

  it("caps capable desktop canvases at 2x pixel ratio", () => {
    setDeviceProfile({ cores: 8, userAgent: MAC_USER_AGENT });
    expect(getCanvasDpr()).toEqual([1, 2]);
  });
});

describe("shouldEnableAntialias", () => {
  it("disables antialias on truly low-end hardware", () => {
    setDeviceProfile({ cores: 2, dpr: 1, userAgent: MAC_USER_AGENT });
    expect(shouldEnableAntialias()).toBe(false);
  });

  it("keeps MSAA antialias enabled on capable mobile Retina displays", () => {
    setDeviceProfile({ cores: 4, dpr: 3, userAgent: IPHONE_USER_AGENT });
    expect(shouldEnableAntialias()).toBe(true);
  });

  it("keeps antialias on non-Retina capable mobile displays", () => {
    setDeviceProfile({ cores: 6, dpr: 1, userAgent: IPHONE_USER_AGENT });
    expect(shouldEnableAntialias()).toBe(true);
  });

  it("enables antialias on capable desktops", () => {
    setDeviceProfile({ cores: 8, dpr: 2, userAgent: MAC_USER_AGENT });
    expect(shouldEnableAntialias()).toBe(true);
  });
});

describe("getMaxWebGLContexts", () => {
  it("caps mobile devices at 2 contexts", () => {
    setDeviceProfile({ cores: 6, userAgent: IPHONE_USER_AGENT });
    expect(getMaxWebGLContexts()).toBe(MOBILE_WEBGL_CONTEXT_LIMIT);
  });

  it("caps low-end desktops at 2 contexts", () => {
    setDeviceProfile({ cores: 2, userAgent: WINDOWS_USER_AGENT });
    expect(getMaxWebGLContexts()).toBe(MOBILE_WEBGL_CONTEXT_LIMIT);
  });

  it("allows 4 contexts on capable desktops", () => {
    setDeviceProfile({ cores: 8, userAgent: MAC_USER_AGENT });
    expect(getMaxWebGLContexts()).toBe(DESKTOP_WEBGL_CONTEXT_LIMIT);
  });
});

describe("isSoftwareRenderer", () => {
  it.each([
    "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
    "llvmpipe (LLVM 15.0.7, 256 bits)",
    "Microsoft Basic Render Driver",
    "Software Rasterizer",
  ])("finds the CPU rasterizer in %s", (renderer) => {
    expect(isSoftwareRenderer(renderer)).toBe(true);
  });

  it.each([
    "ANGLE (Apple, ANGLE Metal Renderer: Apple M3, Unspecified Version)",
    "Adreno (TM) 740",
    "Mali-G78",
  ])("leaves the GPU %s alone", (renderer) => {
    expect(isSoftwareRenderer(renderer)).toBe(false);
  });
});

describe("supportsHalfFloatColorBuffer", () => {
  it("checks half-float or float color buffer extensions on WebGL2", () => {
    const withHalfFloat = {
      getExtension: (name: string) =>
        name === "EXT_color_buffer_half_float" ? {} : null,
    };
    const withFloat = {
      getExtension: (name: string) =>
        name === "EXT_color_buffer_float" ? {} : null,
    };
    const withoutBoth = {
      getExtension: () => null,
    };

    expect(supportsHalfFloatColorBuffer(withHalfFloat, true)).toBe(true);
    expect(supportsHalfFloatColorBuffer(withFloat, true)).toBe(true);
    expect(supportsHalfFloatColorBuffer(withoutBoth, true)).toBe(false);
  });

  it("checks half-float texture and color buffer extensions on WebGL1", () => {
    const withHalfFloat = {
      getExtension: (name: string) =>
        name === "OES_texture_half_float" ||
        name === "EXT_color_buffer_half_float"
          ? {}
          : null,
    };
    const withWebglColorBuffer = {
      getExtension: (name: string) =>
        name === "OES_texture_half_float" || name === "WEBGL_color_buffer_float"
          ? {}
          : null,
    };
    const textureOnly = {
      getExtension: (name: string) =>
        name === "OES_texture_half_float" ? {} : null,
    };
    const none = {
      getExtension: () => null,
    };

    expect(supportsHalfFloatColorBuffer(withHalfFloat, false)).toBe(true);
    expect(supportsHalfFloatColorBuffer(withWebglColorBuffer, false)).toBe(
      true
    );
    expect(supportsHalfFloatColorBuffer(textureOnly, false)).toBe(false);
    expect(supportsHalfFloatColorBuffer(none, false)).toBe(false);
  });
});

describe("isWebGLAvailable", () => {
  it("returns false when WebGLRenderingContext is unavailable", () => {
    setGlobalProperty("WebGLRenderingContext", undefined);
    expect(isWebGLAvailable()).toBe(false);
  });

  it("probes WebGL2 and releases the probe context immediately", () => {
    setGlobalProperty("WebGLRenderingContext", () => undefined);
    const loseContext = vi.fn();
    vi.spyOn(document, "createElement").mockReturnValueOnce(
      Object.assign(document.createElement("div"), {
        getContext: (contextId: string) =>
          contextId === "webgl2"
            ? {
                getExtension: (name: string) =>
                  name === "WEBGL_lose_context" ? { loseContext } : null,
              }
            : null,
      })
    );

    expect(isWebGLAvailable()).toBe(true);
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it("falls back to WebGL1 when WebGL2 returns null", () => {
    setGlobalProperty("WebGLRenderingContext", () => undefined);
    vi.spyOn(document, "createElement").mockReturnValueOnce(
      Object.assign(document.createElement("div"), {
        getContext: (contextId: string) =>
          contextId === "webgl" ? { getExtension: () => null } : null,
      })
    );

    expect(isWebGLAvailable()).toBe(true);
  });

  it("returns false when both WebGL2 and WebGL1 are refused or throw", () => {
    setGlobalProperty("WebGLRenderingContext", () => undefined);
    vi.spyOn(document, "createElement").mockReturnValueOnce(
      Object.assign(document.createElement("div"), {
        getContext: () => null,
      })
    );
    expect(isWebGLAvailable()).toBe(false);

    vi.spyOn(document, "createElement").mockReturnValueOnce(
      Object.assign(document.createElement("div"), {
        getContext: () => {
          throw new Error("blocked");
        },
      })
    );
    expect(isWebGLAvailable()).toBe(false);
  });
});
