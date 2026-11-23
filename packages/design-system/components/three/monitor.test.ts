import { describe, expect, it } from "@effect/vitest";
import { createPerformanceMonitor } from "@repo/design-system/components/three/monitor";

describe("createPerformanceMonitor", () => {
  it("keeps full quality on smooth 60 to 120 fps frames", () => {
    const monitor = createPerformanceMonitor({
      canReduceDpr: true,
      hasPostprocessing: true,
    });

    for (let frame = 0; frame < 30; frame += 1) {
      expect(monitor.record(8.3)).toBe("full");
    }
    expect(monitor.current()).toBe("full");
  });

  it("ignores non-positive, non-finite, and idle-gap frame deltas", () => {
    const monitor = createPerformanceMonitor({
      canReduceDpr: true,
      hasPostprocessing: true,
    });

    expect(monitor.record(0)).toBe("full");
    expect(monitor.record(-5)).toBe("full");
    expect(monitor.record(Number.NaN)).toBe("full");
    expect(monitor.record(250)).toBe("full");
    expect(monitor.current()).toBe("full");
  });

  it("resets consecutive slow frames when frame times recover to 60 fps", () => {
    const monitor = createPerformanceMonitor({
      canReduceDpr: true,
      hasPostprocessing: true,
    });

    for (let frame = 0; frame < 8; frame += 1) {
      expect(monitor.record(28)).toBe("full");
    }
    // Recover below 16.7ms EMA so slow-frame counter clears.
    for (let frame = 0; frame < 20; frame += 1) {
      expect(monitor.record(10)).toBe("full");
    }
    for (let frame = 0; frame < 8; frame += 1) {
      expect(monitor.record(28)).toBe("full");
    }
    expect(monitor.current()).toBe("full");
  });

  it("steps down from full to direct postprocessing off, then reduced DPR after cooldown", () => {
    const monitor = createPerformanceMonitor({
      canReduceDpr: true,
      hasPostprocessing: true,
    });

    // 10 sustained slow frames drop postprocessing first.
    for (let frame = 0; frame < 9; frame += 1) {
      expect(monitor.record(30)).toBe("full");
    }
    expect(monitor.record(30)).toBe("direct");

    // During the 15-frame cooldown, quality holds at direct.
    for (let frame = 0; frame < 15; frame += 1) {
      expect(monitor.record(30)).toBe("direct");
    }

    // 18 more slow frames step down DPR to reduced.
    for (let frame = 0; frame < 17; frame += 1) {
      expect(monitor.record(30)).toBe("direct");
    }
    expect(monitor.record(30)).toBe("reduced");

    // Once at reduced, further samples stay at reduced.
    expect(monitor.record(30)).toBe("reduced");
  });

  it("starts at direct when no postprocessing is active and never reduces DPR when disallowed", () => {
    const monitor = createPerformanceMonitor({
      canReduceDpr: false,
      hasPostprocessing: false,
    });

    expect(monitor.current()).toBe("direct");
    for (let frame = 0; frame < 40; frame += 1) {
      expect(monitor.record(35)).toBe("direct");
    }
    expect(monitor.current()).toBe("direct");
  });

  it("holds counter steady in the hysteresis band between 16.7ms and 20ms", () => {
    const monitor = createPerformanceMonitor({
      canReduceDpr: true,
      hasPostprocessing: true,
    });

    expect(monitor.record(18)).toBe("full");
    expect(monitor.record(18)).toBe("full");
    expect(monitor.current()).toBe("full");
  });
});
