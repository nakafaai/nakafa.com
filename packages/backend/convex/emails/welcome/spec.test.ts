import { describe, expect, it } from "@effect/vitest";
import {
  ACCOUNT_DELETION_RECOVERY_DELAY_MS,
  ACCOUNT_DELETION_RECOVERY_SWEEP_INTERVAL_MINUTES,
} from "@repo/backend/convex/auth/deletion/constants";
import { WELCOME_EMAIL_RETRY } from "@repo/backend/convex/emails/welcome/spec";

/** @see @convex-dev/workpool/src/component/loop.ts withJitter */
const WORKPOOL_MINIMUM_JITTER_FACTOR = 0.5;

function minimumCoveredRetryWindow(maxAttempts: number) {
  return Array.from(
    { length: maxAttempts - 1 },
    (_, retry) =>
      WELCOME_EMAIL_RETRY.initialBackoffMs *
      WELCOME_EMAIL_RETRY.base ** retry *
      WORKPOOL_MINIMUM_JITTER_FACTOR
  ).reduce((total, delay) => total + delay, 0);
}

describe("emails/welcome/spec", () => {
  it("covers deletion recovery even at Workpool's minimum jitter", () => {
    const requiredWindow =
      ACCOUNT_DELETION_RECOVERY_DELAY_MS +
      ACCOUNT_DELETION_RECOVERY_SWEEP_INTERVAL_MINUTES * 60 * 1000;

    expect(
      minimumCoveredRetryWindow(WELCOME_EMAIL_RETRY.maxAttempts)
    ).toBeGreaterThanOrEqual(requiredWindow);
    expect(
      minimumCoveredRetryWindow(WELCOME_EMAIL_RETRY.maxAttempts - 1)
    ).toBeLessThan(requiredWindow);
  });
});
