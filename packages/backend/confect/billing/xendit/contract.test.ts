import { describe, expect, it } from "@effect/vitest";
import { XenditSessionRequest } from "@repo/backend/confect/billing/xendit/contract";
import { Option, Schema } from "effect";

const decode = Schema.decodeUnknownOption(XenditSessionRequest);
const request = {
  amount: 79_000,
  country: "ID",
  currency: "IDR",
  mode: "PAYMENT_LINK",
  reference_id: "billing-1",
  session_type: "PAY",
};

describe("billing/xendit/contract", () => {
  it("takes a positive amount for a payment or a subscription, and exactly zero for a save", () => {
    expect(Option.isSome(decode(request))).toBe(true);
    expect(
      Option.isSome(decode({ ...request, session_type: "SUBSCRIPTION" }))
    ).toBe(true);
    expect(
      Option.isSome(decode({ ...request, amount: 0, session_type: "SAVE" }))
    ).toBe(true);
    expect(Option.isNone(decode({ ...request, amount: 0 }))).toBe(true);
    expect(
      Option.isNone(decode({ ...request, amount: 1, session_type: "SAVE" }))
    ).toBe(true);
  });
});
