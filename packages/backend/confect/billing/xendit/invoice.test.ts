import { describe, expect, it } from "@effect/vitest";
import { invoiceSessionRequest } from "@repo/backend/confect/billing/xendit/invoice";

describe("billing/xendit/invoice", () => {
  it("pays an invoice's total in one session named by its number, open until it is due", () => {
    expect(
      invoiceSessionRequest({
        dueAt: Date.UTC(2026, 10, 9, 5, 0, 0),
        number: "NKF-2026-000001",
        total: 43_696,
      })
    ).toStrictEqual({
      amount: 43_696,
      country: "ID",
      currency: "IDR",
      description: "Nakafa School NKF-2026-000001",
      expires_at: "2026-11-09T05:00:00.000Z",
      locale: "id",
      mode: "PAYMENT_LINK",
      reference_id: "NKF-2026-000001",
      session_type: "PAY",
    });
  });
});
