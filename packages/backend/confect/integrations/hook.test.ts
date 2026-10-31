import { describe, expect, it } from "@effect/vitest";
import {
  integrationWebhookValidator,
  ReceiverUrl,
  retryDelay,
} from "@repo/backend/confect/integrations/hook";
import { Array as Arr, Duration, Option, Schema } from "effect";

const accepts = Schema.is(ReceiverUrl);

/** A stored webhook, active, as its validator takes it. */
const ACTIVE = {
  changes: ["unit.created"],
  clientId: "client",
  revokedAt: null,
  rotatedAt: 1,
  secret: new ArrayBuffer(8),
  status: "active",
  tenantId: "tenant",
  url: "https://sekolah.example/hook",
} as const;

describe("a receiver address", () => {
  it("is a public HTTPS address", () => {
    expect(accepts("https://sekolah.example/hook")).toBe(true);
    expect(accepts("https://93.184.216.34/hook")).toBe(true);
  });

  it.each([
    "http://sekolah.example/hook",
    "https://localhost/hook",
    "https://10.0.0.8/hook",
    "https://user:secret@sekolah.example/hook",
    `https://sekolah.example/${"a".repeat(2048)}`,
  ])("refuses %s", (url) => {
    expect(accepts(url)).toBe(false);
  });
});

describe("the retries of a change", () => {
  it("give eight attempts inside 24 hours, each delay longer than the last", () => {
    const delays = Arr.filterMap(Arr.range(1, 8), retryDelay);
    expect(delays).toHaveLength(7);
    expect(Option.isNone(retryDelay(8))).toBe(true);
    expect(
      Arr.every(Arr.zip(delays, Arr.drop(delays, 1)), ([earlier, later]) =>
        Duration.isLessThan(earlier, later)
      )
    ).toBe(true);
    expect(
      Duration.isLessThan(
        Arr.reduce(delays, Duration.zero, Duration.sum),
        Duration.hours(24)
      )
    ).toBe(true);
  });
});

describe("a stored webhook", () => {
  const holds = Schema.is(integrationWebhookValidator);

  it("holds a secret while active and none once revoked", () => {
    expect(holds(ACTIVE)).toBe(true);
    expect(
      holds({ ...ACTIVE, revokedAt: 2, secret: null, status: "revoked" })
    ).toBe(true);
  });

  it("refuses a revoked webhook that keeps its secret, and an active one without", () => {
    expect(holds({ ...ACTIVE, revokedAt: 2, status: "revoked" })).toBe(false);
    expect(holds({ ...ACTIVE, secret: null })).toBe(false);
  });
});
