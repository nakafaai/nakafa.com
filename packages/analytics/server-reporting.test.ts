import { afterEach, describe, expect, it } from "@effect/vitest";
import { isServerExceptionReportingEnabled } from "@repo/analytics/server-reporting";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("server exception reporting runtime", () => {
  it.each([undefined, "phase-production-server", "unknown-phase"])(
    "enables deployed production reporting for NEXT_PHASE=%s",
    (nextPhase) => {
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("NEXT_PHASE", nextPhase);

      expect(isServerExceptionReportingEnabled()).toBe(true);
    }
  );

  it.each([
    ["production", "phase-production-build"],
    ["preview", "phase-production-server"],
    ["development", "phase-production-server"],
    [undefined, "phase-production-server"],
  ])(
    "fails closed for VERCEL_ENV=%s and NEXT_PHASE=%s",
    (vercelEnvironment, nextPhase) => {
      vi.stubEnv("VERCEL_ENV", vercelEnvironment);
      vi.stubEnv("NEXT_PHASE", nextPhase);

      expect(isServerExceptionReportingEnabled()).toBe(false);
    }
  );
});
