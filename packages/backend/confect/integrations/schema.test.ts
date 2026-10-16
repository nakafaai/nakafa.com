import { describe, expect, it } from "@effect/vitest";
import { integrationClientValidator } from "@repo/backend/confect/integrations/schema";
import { Schema } from "effect";

/** Any time of the registry's clock, as a client row stores it. */
const MOMENT = 1000;
const DIGEST = "0".repeat(64);

/** One active client of a school, as the registry stores it. */
const active = {
  actions: ["person.view"],
  name: "Sinkron Harapan",
  revokedAt: null,
  rotatedAt: MOMENT,
  scope: { kind: "tenant" },
  secretHash: DIGEST,
  status: "active",
  tenantId: "tenant",
};

/** The same client once it is revoked: no secret, and the time of revocation. */
const revoked = {
  ...active,
  revokedAt: MOMENT,
  secretHash: null,
  status: "revoked",
};

describe("integrations/schema", () => {
  it("accepts an active client with its digest and a revoked one with its time", () => {
    expect(Schema.is(integrationClientValidator)(active)).toBe(true);
    expect(Schema.is(integrationClientValidator)(revoked)).toBe(true);
  });

  it("holds a client name to one trimmed line, as a unit name is held", () => {
    const named = (name: string) =>
      Schema.is(integrationClientValidator)({ ...active, name });
    expect([
      named("Sinkron Harapan"),
      named("Sinkron\nHarapan"),
      named(" Sinkron Harapan "),
    ]).toEqual([true, false, false]);
  });

  it("refuses an active client that holds no digest, or a revocation time", () => {
    expect(
      Schema.is(integrationClientValidator)({ ...active, secretHash: null })
    ).toBe(false);
    expect(
      Schema.is(integrationClientValidator)({ ...active, revokedAt: MOMENT })
    ).toBe(false);
  });

  it("refuses a revoked client that still holds a digest, or has no revocation time", () => {
    expect(
      Schema.is(integrationClientValidator)({ ...revoked, secretHash: DIGEST })
    ).toBe(false);
    expect(
      Schema.is(integrationClientValidator)({ ...revoked, revokedAt: null })
    ).toBe(false);
  });
});
