import { describe, expect, it } from "@effect/vitest";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Option, Schema } from "effect";
import {
  pageDeviceIdOf,
  redeemRefusalKey,
  redeemRequestOf,
} from "@/components/tenant/login.client";

const slug = Schema.decodeSync(TenantSlug)("harapan");
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** The form values of one submission, with a card code that the test chooses. */
const valuesWith = (code: string) => ({
  code,
  deviceId: "0f8fad5b-d9cb-4691-a165-8c45a5d2a1e1",
  loginName: "guru.baru",
  password: "correct horse battery",
  slug,
});

describe("redeemRequestOf", () => {
  it("reads a typed code the way Crockford base32 does, with its dashes and capitals", () => {
    expect(redeemRequestOf(valuesWith("abcdo-ilqrs"))).toEqual(
      Option.some({
        code: "ABCD011QRS",
        deviceId: "0f8fad5b-d9cb-4691-a165-8c45a5d2a1e1",
        loginName: "guru.baru",
        password: "correct horse battery",
        slug,
      })
    );
  });

  it("refuses a typed code with a letter the alphabet does not hold", () => {
    expect(redeemRequestOf(valuesWith("UUUUU-UUUUU"))).toEqual(Option.none());
  });
});

describe("redeemRefusalKey", () => {
  it.each([
    ["expired", "card-expired"],
    ["invalid", "card-invalid"],
    ["passwordTooLong", "password-too-long"],
    ["passwordTooShort", "password-too-short"],
    ["rateLimited", "card-rate-limited"],
    ["used", "card-used"],
  ] as const)("gives the refusal %s its own copy key %s", (reason, key) => {
    expect(redeemRefusalKey(reason)).toBe(key);
  });
});

describe("pageDeviceIdOf", () => {
  it.effect("keeps one device for every attempt of the page", () =>
    Effect.gen(function* () {
      const first = yield* pageDeviceIdOf();
      const second = yield* pageDeviceIdOf();
      expect(first).toMatch(UUID);
      expect(second).toBe(first);
    })
  );
});
