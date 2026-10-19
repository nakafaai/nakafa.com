import { describe, expect, it } from "@effect/vitest";
import type { RedeemOutcome } from "@repo/backend/confect/identity/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Option, Schema } from "effect";
import {
  pageDeviceIdOf,
  RedeemUnanswered,
  redeemRefusalKey,
  redeemRequestOf,
  submitLogin,
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

/**
 * Ports that answer one redemption and one password sign-in, and count the requests that reach
 * them. A `failure` redemption fails the request itself, not the card.
 */
const portsOf = (
  redeemed: typeof RedeemOutcome.Type | "failure",
  signedIn: boolean
) => {
  const requests = { redeems: 0, signIns: 0 };
  return {
    ports: {
      redeem: () => {
        requests.redeems += 1;
        return redeemed === "failure"
          ? Effect.fail(new RedeemUnanswered())
          : Effect.succeed(redeemed);
      },
      signIn: () => {
        requests.signIns += 1;
        return Effect.succeed(signedIn);
      },
    },
    requests,
  };
};

const redeemed: typeof RedeemOutcome.Type = {
  loginName: "guru.baru",
  outcome: "redeemed",
};
const used: typeof RedeemOutcome.Type = { outcome: "refused", reason: "used" };

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

describe("submitLogin", () => {
  it.effect(
    "signs the student in with the password when no card code is typed",
    () =>
      Effect.gen(function* () {
        const { ports, requests } = portsOf("failure", true);
        expect(yield* submitLogin(valuesWith("  "), ports)).toBe("signed-in");
        expect(requests).toEqual({ redeems: 0, signIns: 1 });
      })
  );

  it.effect(
    "answers the sign-in refusal when no card code is typed and the password is wrong",
    () =>
      Effect.gen(function* () {
        const { ports } = portsOf("failure", false);
        expect(yield* submitLogin(valuesWith(""), ports)).toBe(
          "sign-in-refused"
        );
      })
  );

  it.effect(
    "answers the card message for a code that the alphabet does not hold, without a request",
    () =>
      Effect.gen(function* () {
        const { ports, requests } = portsOf(redeemed, true);
        expect(yield* submitLogin(valuesWith("UUUUU-UUUUU"), ports)).toBe(
          "card-invalid"
        );
        expect(requests).toEqual({ redeems: 0, signIns: 0 });
      })
  );

  it.effect(
    "answers the failure message when the redemption request fails",
    () =>
      Effect.gen(function* () {
        const { ports, requests } = portsOf("failure", true);
        expect(yield* submitLogin(valuesWith("ABCDE-FGHJK"), ports)).toBe(
          "failed"
        );
        expect(requests).toEqual({ redeems: 1, signIns: 0 });
      })
  );

  it.effect("signs a redeemed card in with the password", () =>
    Effect.gen(function* () {
      const { ports, requests } = portsOf(redeemed, true);
      expect(yield* submitLogin(valuesWith("ABCDE-FGHJK"), ports)).toBe(
        "signed-in"
      );
      expect(requests).toEqual({ redeems: 1, signIns: 1 });
    })
  );

  it.effect(
    "answers the sign-in refusal after a redeemed card when the password does not sign in",
    () =>
      Effect.gen(function* () {
        const { ports } = portsOf(redeemed, false);
        expect(yield* submitLogin(valuesWith("ABCDE-FGHJK"), ports)).toBe(
          "sign-in-refused"
        );
      })
  );

  it.effect(
    "signs a student in after a used card when the password is right, so a lost reply retries cleanly",
    () =>
      Effect.gen(function* () {
        const { ports, requests } = portsOf(used, true);
        expect(yield* submitLogin(valuesWith("ABCDE-FGHJK"), ports)).toBe(
          "signed-in"
        );
        expect(requests).toEqual({ redeems: 1, signIns: 1 });
      })
  );

  it.effect(
    "answers the card-used message when a used card's password does not sign in",
    () =>
      Effect.gen(function* () {
        const { ports } = portsOf(used, false);
        expect(yield* submitLogin(valuesWith("ABCDE-FGHJK"), ports)).toBe(
          "card-used"
        );
      })
  );

  it.effect(
    "answers another refusal with its own message, without a sign-in",
    () =>
      Effect.gen(function* () {
        const { ports, requests } = portsOf(
          { outcome: "refused", reason: "expired" },
          true
        );
        expect(yield* submitLogin(valuesWith("ABCDE-FGHJK"), ports)).toBe(
          "card-expired"
        );
        expect(requests).toEqual({ redeems: 1, signIns: 0 });
      })
  );
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
