import { describe, expect, it } from "@effect/vitest";
import {
  sameCallbackToken,
  xenditDeliveryKey,
} from "@repo/backend/confect/billing/xendit/webhook";

describe("billing/xendit/webhook", () => {
  it("accepts the deployment's callback token and refuses any other", () => {
    expect(sameCallbackToken("token-abc", "token-abc")).toBe(true);
    expect(sameCallbackToken("token-abd", "token-abc")).toBe(false);
    expect(sameCallbackToken("token", "token-abc")).toBe(false);
    expect(sameCallbackToken("", "token-abc")).toBe(false);
  });

  it("keys a delivery by its event, object, status and update time", () => {
    expect(
      xenditDeliveryKey({
        business_id: "biz_1",
        created: "2026-10-24T00:00:00Z",
        data: {
          id: "recy_1",
          status: "SUCCEEDED",
          updated: "2026-10-24T00:00:01Z",
        },
        event: "recurring.cycle.succeeded",
      })
    ).toBe("recurring.cycle.succeeded:recy_1:SUCCEEDED:2026-10-24T00:00:01Z");
  });

  it("keeps a delivery without an object or update time distinct", () => {
    expect(
      xenditDeliveryKey({
        business_id: "biz_1",
        created: "2026-10-24T00:00:00Z",
        data: {},
        event: "payment_token.expiry",
      })
    ).toBe("payment_token.expiry:::");
  });
});
