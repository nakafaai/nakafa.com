import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { BILLING_EVENT_RETENTION_MS } from "@repo/backend/confect/billing/events";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 9, 24);
const delivery = {
  key: "impl:recy_1",
  payload: "{}",
  providerTime: NOW,
  rail: "xendit" as const,
  type: "recurring.cycle.succeeded",
};

describe("billing/events.impl", () => {
  it.effect("records a delivery once through the registered function", () =>
    Effect.gen(function* () {
      const t = yield* Confect;
      const first = yield* t.mutation(
        refs.internal.billing.events.record,
        delivery
      );
      const again = yield* t.mutation(
        refs.internal.billing.events.record,
        delivery
      );
      expect(first.kind).toBe("accepted");
      expect(again).toEqual({ eventId: first.eventId, kind: "duplicate" });
    }).pipe(Effect.provide(confectLayer))
  );

  it.effect("deletes expired rows through the registered cleanup", () =>
    Effect.gen(function* () {
      const t = yield* Confect;
      yield* t.run(
        Effect.gen(function* () {
          const writer = yield* DatabaseWriter;
          yield* writer.table("billingEvents").insert({
            ...delivery,
            key: "expired",
            processedAt: NOW - BILLING_EVENT_RETENTION_MS - 1,
            receivedAt: NOW - BILLING_EVENT_RETENTION_MS - 1,
          });
        })
      );
      expect(yield* t.mutation(refs.internal.billing.events.cleanup)).toBe(1);
    }).pipe(Effect.provide(confectLayer))
  );
});
