import { describe, expect, it } from "@effect/vitest";
import {
  planRequest,
  renewalAnchor,
} from "@repo/backend/confect/billing/xendit/renewal";
import { DateTime } from "effect";

/** 26 Oct 2026, 12:00 in Jakarta. */
const NOW = Date.UTC(2026, 9, 26, 5, 0, 0);

describe("billing/xendit/renewal", () => {
  it("renews on the same day in Jakarta a period later, or on the 28th when the day is later", () => {
    expect(DateTime.formatIsoOffset(renewalAnchor(NOW, 1))).toBe(
      "2026-11-26T12:00:00.000+07:00"
    );
    // 30 Oct 20:00 UTC is already 31 Oct in Jakarta, and 30 Nov is past the 28th.
    expect(
      DateTime.formatIsoOffset(
        renewalAnchor(Date.UTC(2026, 9, 30, 20, 0, 0), 1)
      )
    ).toBe("2026-11-28T03:00:00.000+07:00");
    expect(
      DateTime.formatIsoOffset(
        renewalAnchor(Date.UTC(2027, 0, 10, 0, 0, 0), 12)
      )
    ).toBe("2028-01-10T07:00:00.000+07:00");
  });

  it("charges the saved channel from the end of the paid month, retries three days, and stops after a renewal that fails every retry", () => {
    const anchor = DateTime.toEpochMillis(renewalAnchor(NOW, 1));
    expect(
      planRequest({
        locale: "id",
        referenceId: "subscription-1",
        renewal: {
          amount: 79_000,
          anchor,
          customerId: "cust-1",
          months: 1,
          offer: "pro.monthly",
          tokenId: "pt-1",
        },
      })
    ).toStrictEqual({
      amount: 79_000,
      currency: "IDR",
      customer_id: "cust-1",
      description: "Nakafa Pro, diperpanjang setiap bulan",
      failed_cycle_action: "STOP",
      immediate_payment: false,
      locale: "id",
      payment_tokens: [{ payment_token_id: "pt-1", rank: 1 }],
      reference_id: "subscription-1",
      schedule: {
        anchor_date: "2026-11-26T12:00:00.000+07:00",
        failed_attempt_notifications: [1, 2, 3],
        interval: "MONTH",
        interval_count: 1,
        retry_interval: "DAY",
        retry_interval_count: 1,
        total_retry: 3,
      },
    });
  });
});
