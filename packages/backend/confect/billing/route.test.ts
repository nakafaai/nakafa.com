import { describe, expect, it } from "@effect/vitest";
import {
  OfferUnavailable,
  readIndonesiaRail,
  routeOffer,
  XenditNotConfigured,
} from "@repo/backend/confect/billing/route";
import { ConfigProvider, Effect } from "effect";

/** The deployment environment one test runs routing under. */
function environment(env: Record<string, string>) {
  return ConfigProvider.fromUnknown(env);
}

const xenditKeys = { XENDIT_SECRET_KEY: "test-secret" };

describe("billing/route", () => {
  it.effect("keeps Indonesia on Polar while the switch is unset", () =>
    Effect.gen(function* () {
      const route = yield* routeOffer("ID", "pro.monthly");
      expect(route).toEqual({ amount: 79_000, currency: "IDR", rail: "polar" });
    }).pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, environment({}))
    )
  );

  it.effect("routes Indonesia to Xendit when the switch and keys are set", () =>
    Effect.gen(function* () {
      const route = yield* routeOffer("ID", "pro.pass.3");
      expect(route).toEqual({
        amount: 229_000,
        currency: "IDR",
        rail: "xendit",
      });
    }).pipe(
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        environment({ BILLING_INDONESIA_RAIL: "xendit", ...xenditKeys })
      )
    )
  );

  it.effect(
    "falls back to Polar for an offer Polar sells when the keys are missing",
    () =>
      Effect.gen(function* () {
        const route = yield* routeOffer("ID", "pro.monthly");
        expect(route.rail).toBe("polar");
      }).pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          environment({ BILLING_INDONESIA_RAIL: "xendit" })
        )
      )
  );

  it.effect(
    "fails a Xendit-only checkout with a tagged error when the keys are missing",
    () =>
      Effect.gen(function* () {
        const error = yield* routeOffer("ID", "pro.pass.1").pipe(Effect.flip);
        expect(error).toBeInstanceOf(XenditNotConfigured);
      }).pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          environment({ BILLING_INDONESIA_RAIL: "xendit" })
        )
      )
  );

  it.effect("refuses a pass while the switch still names Polar", () =>
    Effect.gen(function* () {
      const error = yield* routeOffer("ID", "pro.pass.1").pipe(Effect.flip);
      expect(error).toBeInstanceOf(OfferUnavailable);
      expect(error).toMatchObject({ rail: "polar", currency: "IDR" });
    }).pipe(
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        environment({ BILLING_INDONESIA_RAIL: "polar", ...xenditKeys })
      )
    )
  );

  it.effect(
    "refuses Pro yearly on Xendit, where the Pro pass replaces it",
    () =>
      Effect.gen(function* () {
        const error = yield* routeOffer("ID", "pro.yearly").pipe(Effect.flip);
        expect(error).toBeInstanceOf(OfferUnavailable);
      }).pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          environment({ BILLING_INDONESIA_RAIL: "xendit", ...xenditKeys })
        )
      )
  );

  it.effect(
    "bills the euro territories in EUR and other countries in USD",
    () =>
      Effect.gen(function* () {
        const german = yield* routeOffer("DE", "pro.monthly");
        const american = yield* routeOffer("US", "pro.monthly");
        expect(german).toEqual({ amount: 899, currency: "EUR", rail: "polar" });
        expect(american).toEqual({
          amount: 899,
          currency: "USD",
          rail: "polar",
        });
      }).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, environment({}))
      )
  );

  it.effect("reads the switch as polar when the value is unset", () =>
    Effect.gen(function* () {
      expect(yield* readIndonesiaRail).toBe("polar");
    }).pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, environment({}))
    )
  );

  it.effect("rejects a switch value that is neither polar nor xendit", () =>
    Effect.gen(function* () {
      const error = yield* readIndonesiaRail.pipe(Effect.flip);
      expect(error).toBeDefined();
    }).pipe(
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        environment({ BILLING_INDONESIA_RAIL: "mayar" })
      )
    )
  );
});
