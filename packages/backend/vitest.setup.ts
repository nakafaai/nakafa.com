import { afterEach, vi } from "@effect/vitest";

/** Restores real timers after every backend test to prevent timer leakage. */
afterEach(() => {
  vi.useRealTimers();
});
