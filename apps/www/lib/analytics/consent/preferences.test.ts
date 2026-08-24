import { describe, expect, it } from "vitest";
import {
  initialConsentPreferences,
  updateConsentPreferences,
} from "@/lib/analytics/consent/preferences";

describe("analytics consent preferences", () => {
  it("snapshots the status only when the dialog opens", () => {
    const open = updateConsentPreferences({
      current: initialConsentPreferences,
      isOpen: true,
      status: "granted",
    });
    const closed = updateConsentPreferences({
      current: open,
      isOpen: false,
      status: "pending",
    });

    expect(open).toEqual({ isOpen: true, statusAtOpen: "granted" });
    expect(closed).toEqual({ isOpen: false, statusAtOpen: "granted" });
  });

  it("preserves the current object when visibility does not change", () => {
    const current = { isOpen: true, statusAtOpen: "browser-signal" } as const;

    expect(
      updateConsentPreferences({
        current,
        isOpen: true,
        status: "denied",
      })
    ).toBe(current);
  });
});
