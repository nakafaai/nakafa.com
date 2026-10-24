import { describe, expect, it } from "@effect/vitest";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { syncSubscriptionGrant } from "@repo/backend/confect/billing/grants";
import { applySubscriptionState } from "@repo/backend/confect/billing/subscriptions";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { MASCOT } from "@repo/backend/test/mascot";
import { Effect, Schema } from "effect";

const START = Date.UTC(2026, 9, 1);
const PERIOD_END = Date.UTC(2026, 10, 1);

describe("billing/grants.impl", () => {
  it.effect(
    "projects Pro through the registered function and reports nothing back",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect;
        const userId = yield* t.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            const userId = yield* writer.table("users").insert({
              authId: "auth-grants-impl",
              credits: 0,
              creditsResetAt: START,
              email: "grants-impl@example.com",
              mascot: MASCOT,
              name: "Grants Impl",
              plan: "free",
            });
            const accountId = yield* writer.table("billingAccounts").insert({
              owner: { kind: "personal", userId },
              rail: "polar",
              country: "ID",
              currency: "IDR",
              providerCustomerId: null,
            });
            const applied = yield* applySubscriptionState({
              accountId,
              offer: "pro.monthly",
              quantity: 1,
              status: "active",
              currentPeriodStart: START,
              currentPeriodEnd: PERIOD_END,
              cancelAtPeriodEnd: false,
              provider: {
                kind: "polar",
                subscriptionId: "sub_grants_impl",
                productId: "prod_grants_impl",
                priceId: null,
              },
              providerUpdatedAt: START,
            });
            yield* syncSubscriptionGrant(applied.subscriptionId, START);
            return userId;
          }),
          IdSchema("users")
        );
        const projected = yield* t.mutation(
          refs.internal.billing.grants.project,
          {
            userId,
          }
        );
        const plan = yield* t.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            const user = yield* reader
              .table("users")
              .get(userId)
              .pipe(Effect.orDie);
            return user.plan;
          }),
          Schema.Literals(["free", "pro"])
        );
        expect(projected).toBeNull();
        expect(plan).toBe("pro");
      }).pipe(Effect.provide(confectLayer))
  );
});
