import { afterEach, describe, expect, it } from "@effect/vitest";
import { isServerExceptionReportingEnabled } from "@repo/analytics/gate";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("server exception reporting runtime", () => {
  it.each([undefined, "false", "unknown-phase"])(
    "enables deployed production reporting for TSS_PRERENDERING=%s",
    (prerendering) => {
      vi.stubEnv("NAKAFA_DEPLOY_STAGE", "prod");
      vi.stubEnv("TSS_PRERENDERING", prerendering);

      expect(isServerExceptionReportingEnabled()).toBe(true);
    }
  );

  it.each([
    ["prod", "true"],
    ["staging", "false"],
    ["development", "false"],
    [undefined, "false"],
  ])(
    "fails closed for NAKAFA_DEPLOY_STAGE=%s and TSS_PRERENDERING=%s",
    (deployStage, prerendering) => {
      vi.stubEnv("NAKAFA_DEPLOY_STAGE", deployStage);
      vi.stubEnv("TSS_PRERENDERING", prerendering);

      expect(isServerExceptionReportingEnabled()).toBe(false);
    }
  );
});
