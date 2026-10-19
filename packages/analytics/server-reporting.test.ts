import { afterEach, describe, expect, it } from "@effect/vitest";
import { isServerExceptionReportingEnabled } from "@repo/analytics/server-reporting";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("server exception reporting runtime", () => {
  it.each([undefined, "false", "unknown-phase"])(
    "enables deployed production reporting for TSS_PRERENDERING=%s",
    (prerendering) => {
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("TSS_PRERENDERING", prerendering);

      expect(isServerExceptionReportingEnabled()).toBe(true);
    }
  );

  it.each([
    ["production", "true"],
    ["preview", "false"],
    ["development", "false"],
    [undefined, "false"],
  ])(
    "fails closed for VERCEL_ENV=%s and TSS_PRERENDERING=%s",
    (vercelEnvironment, prerendering) => {
      vi.stubEnv("VERCEL_ENV", vercelEnvironment);
      vi.stubEnv("TSS_PRERENDERING", prerendering);

      expect(isServerExceptionReportingEnabled()).toBe(false);
    }
  );
});
