import { getAdaptiveInequalityResolution } from "@repo/design-system/components/three/inequality-data";
import { afterEach, describe, expect, it } from "@repo/testing/effect";

const originalHardwareConcurrency = navigator.hardwareConcurrency;
const originalUserAgent = navigator.userAgent;
const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0";
const MOBILE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)";

function setNavigatorState(userAgent: string, hardwareConcurrency?: number) {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: userAgent,
  });
  Object.defineProperty(navigator, "hardwareConcurrency", {
    configurable: true,
    value: hardwareConcurrency,
  });
}

afterEach(() => {
  setNavigatorState(originalUserAgent, originalHardwareConcurrency);
});

describe("getAdaptiveInequalityResolution", () => {
  it("caps mobile scenes at the low-device budget", () => {
    setNavigatorState(MOBILE_USER_AGENT, 12);

    expect(getAdaptiveInequalityResolution(200)).toBe(50);
  });

  it("caps low-core desktop scenes at the low-device budget", () => {
    setNavigatorState(DESKTOP_USER_AGENT, 2);

    expect(getAdaptiveInequalityResolution(200)).toBe(50);
  });

  it("caps medium-core desktop scenes at the medium-device budget", () => {
    setNavigatorState(DESKTOP_USER_AGENT, 6);

    expect(getAdaptiveInequalityResolution(200)).toBe(100);
  });

  it("keeps the requested resolution on high-core desktop scenes", () => {
    setNavigatorState(DESKTOP_USER_AGENT, 8);

    expect(getAdaptiveInequalityResolution(200)).toBe(200);
  });

  it("uses the medium-core default when the browser reports no core count", () => {
    setNavigatorState(DESKTOP_USER_AGENT);

    expect(getAdaptiveInequalityResolution(80)).toBe(80);
  });
});
