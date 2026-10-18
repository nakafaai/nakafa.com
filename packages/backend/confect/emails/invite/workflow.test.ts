import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { runInviteEmailDelivery } from "@repo/backend/confect/emails/invite/workflow";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { invitePerson, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Order, Schema } from "effect";

const address = Schema.decodeSync(Email)("kepala@harapan.example.test");
const { internal } = refs.internal.emails.invite;
const input = {
  locale: "id",
  organisation: "Yayasan Nakafa",
  privacyPolicyUrl: "https://nakafa.com/id/privacy",
  signInUrl: "https://nf.nakafa.com/",
  termsOfServiceUrl: "https://nakafa.com/id/terms",
};
const message = { html: "<p>Masuk</p>", subject: "Diundang", text: "Masuk" };
const requestedAt = Date.UTC(2026, 9, 13, 9, 0, 0);

describe("emails/invite/workflow", () => {
  it.effect(
    "reads what to say, renders it with retries, and hands it over, in that order",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { inviteId } = yield* fixture.run(
          invitePerson(fixture.tenants.nf, address)
        );
        const runQuery = vi.fn(async () => input);
        const runAction = vi.fn(async () => message);
        const runMutation = vi.fn(async () => null);
        const done = yield* Effect.promise(() =>
          runInviteEmailDelivery(
            { runAction, runMutation, runQuery },
            { inviteId, locale: "id", requestedAt }
          )
        );
        const order = Arr.flatMap(
          [runQuery, runAction, runMutation],
          (step) => step.mock.invocationCallOrder
        );
        expect(done).toBeNull();
        expect(order).toHaveLength(3);
        expect(order).toEqual(Arr.sort(order, Order.Number));
        expect(runQuery).toHaveBeenCalledExactlyOnceWith(
          Ref.getFunctionReference(internal.readInput),
          { inviteId, locale: "id" }
        );
        expect(runAction).toHaveBeenCalledExactlyOnceWith(
          Ref.getFunctionReference(refs.internal.emails.invite.delivery.render),
          input,
          { retry: true }
        );
        expect(runMutation).toHaveBeenCalledExactlyOnceWith(
          Ref.getFunctionReference(internal.enqueueRendered),
          { inviteId, requestedAt, ...message }
        );
      })
  );

  it.effect("stops when the invitation reads as nothing", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { inviteId } = yield* fixture.run(
        invitePerson(fixture.tenants.nf, address)
      );
      const runQuery = vi.fn(async () => null);
      const runAction = vi.fn(async () => message);
      const runMutation = vi.fn(async () => null);
      yield* Effect.promise(() =>
        runInviteEmailDelivery(
          { runAction, runMutation, runQuery },
          { inviteId, locale: "id", requestedAt }
        )
      );
      expect(runAction).not.toHaveBeenCalled();
      expect(runMutation).not.toHaveBeenCalled();
    })
  );
});
