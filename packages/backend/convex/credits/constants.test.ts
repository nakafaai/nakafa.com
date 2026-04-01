import {
  getCurrentCreditResetTimestamp,
  getEffectiveCreditStateForResetTimestamp,
} from "@repo/backend/convex/credits/helpers/state";
import { describe, expect, it } from "vitest";

describe("credits constants", () => {
  describe("getCurrentCreditResetTimestamp", () => {
    it("returns the current UTC day boundary for free users", () => {
      const now = Date.UTC(2026, 3, 1, 18, 45, 12);

      expect(getCurrentCreditResetTimestamp("free", now)).toBe(
        Date.UTC(2026, 3, 1, 0, 0, 0)
      );
    });

    it("returns the current UTC month boundary for pro users", () => {
      const now = Date.UTC(2026, 3, 18, 18, 45, 12);

      expect(getCurrentCreditResetTimestamp("pro", now)).toBe(
        Date.UTC(2026, 3, 1, 0, 0, 0)
      );
    });
  });

  describe("getEffectiveCreditStateForResetTimestamp", () => {
    it("keeps the stored balance when the reset window is current", () => {
      expect(
        getEffectiveCreditStateForResetTimestamp(
          {
            credits: 7,
            creditsResetAt: Date.UTC(2026, 3, 1, 0, 0, 0),
            plan: "free",
          },
          Date.UTC(2026, 3, 1, 0, 0, 0)
        )
      ).toEqual({
        credits: 7,
        creditsResetAt: Date.UTC(2026, 3, 1, 0, 0, 0),
      });
    });

    it("resets stale positive balances to the current plan amount", () => {
      expect(
        getEffectiveCreditStateForResetTimestamp(
          {
            credits: 99,
            creditsResetAt: Date.UTC(2026, 3, 1, 0, 0, 0),
            plan: "free",
          },
          Date.UTC(2026, 3, 2, 0, 0, 0)
        )
      ).toEqual({
        credits: 10,
        creditsResetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
      });
    });

    it("carries negative balances into the new reset window", () => {
      expect(
        getEffectiveCreditStateForResetTimestamp(
          {
            credits: -5,
            creditsResetAt: Date.UTC(2026, 3, 1, 0, 0, 0),
            plan: "pro",
          },
          Date.UTC(2026, 4, 1, 0, 0, 0)
        )
      ).toEqual({
        credits: 2995,
        creditsResetAt: Date.UTC(2026, 4, 1, 0, 0, 0),
      });
    });
  });
});
