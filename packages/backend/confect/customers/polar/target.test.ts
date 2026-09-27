import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { seedDeletionUser } from "@repo/backend/test/deletion/seed";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 6, 29, 0, 0, 0);
const target =
  refs.internal.customers.queries.internal.customer.resolveWebhookTarget;

describe("customers/polar/target", () => {
  it.effect(
    "preserves a typed failure when the external identity is ambiguous",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect;
        yield* t.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            for (const suffix of ["first", "second"]) {
              yield* writer.table("users").insert({
                authId: "auth-duplicate",
                credits: 0,
                creditsResetAt: NOW,
                email: `${suffix}@example.com`,
                name: `User ${suffix}`,
                plan: "free",
              });
            }
          })
        );
        expect(
          yield* t
            .query(target, {
              externalId: "auth-duplicate",
              polarCustomerId: "polar-duplicate",
            })
            .pipe(Effect.flip)
        ).toMatchObject({
          code: "POLAR_CUSTOMER_WEBHOOK_TARGET_IO_FAILED",
          _tag: "PolarCustomerWebhookTargetIoError",
        });
      }).pipe(Effect.provide(confectLayer))
  );
  it.effect.each(["missing", "deleted", "invalid"])(
    "resolves a %s metadata owner without assigning another account",
    (state) =>
      Effect.gen(function* () {
        const t = yield* Confect;
        const userId = yield* t.run(
          Effect.gen(function* () {
            const ctx = yield* MutationCtx;
            const writer = yield* DatabaseWriter;
            const id = yield* Effect.promise(() =>
              seedDeletionUser(ctx, "webhook-owner", { deletedAt: NOW })
            );
            if (state === "missing") {
              yield* writer.table("users").delete(id);
            }
            return id;
          }),
          Id("users")
        );
        expect(
          yield* t.query(target, {
            metadataUserId: state === "invalid" ? "invalid-user-id" : userId,
            polarCustomerId: "polar-owner",
          })
        ).toEqual({ kind: state === "invalid" ? "missing" : state });
      }).pipe(Effect.provide(confectLayer))
  );
});
