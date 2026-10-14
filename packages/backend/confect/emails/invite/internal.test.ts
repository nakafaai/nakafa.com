import { Resend } from "@convex-dev/resend";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { EMAIL_FROM, resend } from "@repo/backend/confect/emails/client";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { invitePerson, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect, Schema } from "effect";

const address = Schema.decodeSync(Email)("kepala@harapan.example.test");
const enqueueRendered = refs.internal.emails.invite.internal.enqueueRendered;
const message = { html: "<p>Sign in</p>", subject: "Invited", text: "Sign in" };
const requestedAt = Date.UTC(2026, 9, 13, 9, 0, 0);
const resentAt = requestedAt + Duration.toMillis(Duration.minutes(20));
const testResend = new Resend(components.resend, {
  apiKey: "re_test_invite",
  testMode: true,
});

/** Fake timers keep the mail component from sending what the test hands it. */
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("emails/invite/internal", () => {
  it.effect(
    "hands one message to the address of the invite, however often it is asked",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { inviteId } = yield* fixture.run(
          invitePerson(fixture.tenants.nf, address)
        );
        const send = vi.spyOn(resend, "sendEmail");
        yield* fixture.internal.mutation(enqueueRendered, {
          inviteId,
          requestedAt,
          ...message,
        });
        yield* fixture.internal.mutation(enqueueRendered, {
          inviteId,
          requestedAt,
          ...message,
        });
        const [first, second] = yield* Effect.promise(() =>
          Promise.all(Arr.map(send.mock.results, (result) => result.value))
        );
        const stored = yield* fixture.run(
          Effect.flatMap(MutationCtx, (ctx) =>
            Effect.promise(() => testResend.get(ctx, first))
          )
        );
        expect(send).toHaveBeenCalledTimes(2);
        expect(second).toBe(first);
        expect(stored).toMatchObject({
          from: EMAIL_FROM,
          html: "<p>Sign in</p>",
          subject: "Invited",
          text: "Sign in",
          to: [address],
        });
      })
  );

  it.effect(
    "sends a resend as a new message, because each send has its own moment",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { inviteId } = yield* fixture.run(
          invitePerson(fixture.tenants.nf, address)
        );
        const send = vi.spyOn(resend, "sendEmail");
        yield* fixture.internal.mutation(enqueueRendered, {
          inviteId,
          requestedAt,
          ...message,
        });
        yield* fixture.internal.mutation(enqueueRendered, {
          inviteId,
          requestedAt: resentAt,
          ...message,
        });
        const [first, resent] = yield* Effect.promise(() =>
          Promise.all(Arr.map(send.mock.results, (result) => result.value))
        );
        expect(send).toHaveBeenCalledTimes(2);
        expect(resent).not.toBe(first);
      })
  );

  it.effect("sends nothing for an invite that was revoked", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { inviteId } = yield* fixture.run(
        invitePerson(fixture.tenants.nf, address, {
          invite: { at: 1, status: "revoked" },
        })
      );
      const send = vi.spyOn(resend, "sendEmail");
      yield* fixture.internal.mutation(enqueueRendered, {
        inviteId,
        requestedAt,
        ...message,
      });
      expect(send).not.toHaveBeenCalled();
    })
  );
});
