import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import {
  EMAIL_FROM,
  resend,
  sendMail,
} from "@repo/backend/confect/emails/client";
import { loginAddress } from "@repo/backend/confect/identity/address";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const message = { html: "<p>Hi</p>", subject: "Hi", text: "Hi" };

/** Fake timers keep the mail component from running anything the test did not start. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("emails/client sendMail", () => {
  it.effect(
    "refuses a message to a login address before the provider is called",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const send = vi.spyOn(resend, "sendEmail");
        const refused = yield* fixture.run(
          Effect.gen(function* () {
            const ctx = yield* MutationCtx;
            return yield* sendMail(ctx, {
              ...message,
              from: EMAIL_FROM,
              to: loginAddress("raka"),
            }).pipe(
              Effect.flip,
              Effect.map((error) => ({ code: error.code, tag: error._tag }))
            );
          })
        );
        expect(refused).toEqual({
          code: "LOGIN_ADDRESS_REFUSED",
          tag: "LoginAddressRefused",
        });
        expect(send).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "refuses a message that names a login address among its recipients",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const send = vi.spyOn(resend, "sendEmail");
        const refused = yield* fixture.run(
          Effect.gen(function* () {
            const ctx = yield* MutationCtx;
            return yield* sendMail(ctx, {
              ...message,
              from: EMAIL_FROM,
              to: ["guru@harapan.example.test", loginAddress("raka")],
            }).pipe(
              Effect.flip,
              Effect.map((error) => error._tag)
            );
          })
        );
        expect(refused).toBe("LoginAddressRefused");
        expect(send).not.toHaveBeenCalled();
      })
  );

  it.effect("hands a message to an ordinary address to the provider", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const send = vi.spyOn(resend, "sendEmail");
      yield* fixture.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx;
          return yield* sendMail(ctx, {
            ...message,
            from: EMAIL_FROM,
            to: "guru@harapan.example.test",
          });
        })
      );
      expect(send).toHaveBeenCalledOnce();
    })
  );
});
