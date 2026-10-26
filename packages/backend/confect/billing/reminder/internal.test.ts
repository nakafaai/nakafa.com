import type { GenericId } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { resend } from "@repo/backend/confect/emails/client";
import { loginAddress } from "@repo/backend/confect/identity/address";
import { insertTestPage } from "@repo/backend/test/content/page";
import { insertRuntimeRelease } from "@repo/backend/test/content/runtime";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Duration, Effect } from "effect";

const { enqueue, readInput } = refs.internal.billing.reminder.internal;
const { deliver } = refs.internal.billing.reminder.delivery;
const PASS_END = TENANCY_NOW + Duration.toMillis(Duration.days(30));
const message = { html: "<p>Extend</p>", subject: "Ends soon", text: "Extend" };

/** The signed legal Pages of every language, as the production release holds them. */
const signedPages = Effect.gen(function* () {
  const ctx = yield* MutationCtx;
  yield* Effect.promise(async () => {
    await insertRuntimeRelease(ctx, ["page"]);
    for (const locale of ACTIVE_APP_LOCALE_CODES) {
      await insertTestPage(ctx, locale, "privacy-policy", `privacy-${locale}`);
      await insertTestPage(ctx, locale, "terms-of-service", `terms-${locale}`);
    }
  });
});

/** Gives a user one paid pass that runs until `validTo`, and returns its grant. */
const grantPass = (userId: GenericId.GenericId<"users">, validTo: number) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx;
    return yield* Effect.promise(async () => {
      const accountId = await ctx.db.insert("billingAccounts", {
        owner: { kind: "personal", userId },
        rail: "xendit",
        country: "ID",
        currency: "IDR",
        providerCustomerId: null,
      });
      const paymentId = await ctx.db.insert("billingPayments", {
        kind: "pass",
        accountId,
        status: "succeeded",
        amount: 79_000,
        currency: "IDR",
        rail: "xendit",
        providerPaymentId: `py-${validTo}`,
        providerUpdatedAt: TENANCY_NOW,
        method: "session",
        paidAt: TENANCY_NOW,
      });
      return await ctx.db.insert("billingGrants", {
        product: "pro",
        userId,
        source: { kind: "pass", paymentId },
        validFrom: TENANCY_NOW,
        validTo,
      });
    });
  });

/** The address one user's mail goes to. */
const emailOf = (userId: GenericId.GenericId<"users">) =>
  Effect.flatMap(MutationCtx, (ctx) =>
    Effect.promise(async () => (await ctx.db.get(userId))?.email)
  );

/** Fake timers hold the mail component's own sends, and the clock stands where the fixture writes. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("billing/reminder", () => {
  it.effect(
    "says when the last pass ends, where to extend it, and the legal links, in the language it was bought in",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(signedPages);
        const grantId = yield* fixture.run(
          grantPass(fixture.users.owner.userId, PASS_END)
        );
        expect(
          yield* fixture.internal.query(readInput, { grantId, locale: "id" })
        ).toEqual({
          endsAt: PASS_END,
          extendUrl: "http://localhost:3000/id/user/settings/subscriptions",
          locale: "id",
          privacyPolicyUrl: "http://localhost:3000/id/privacy-id",
          termsOfServiceUrl: "http://localhost:3000/id/terms-id",
        });
      })
  );

  it.effect(
    "reads nothing once a later pass extends Pro, for Pro that is no pass, for a pass that is gone, or for an account that is deleting, gone or a school login",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(signedPages);
        const owner = fixture.users.owner.userId;
        const first = yield* fixture.run(grantPass(owner, PASS_END));
        yield* fixture.run(grantPass(owner, PASS_END + 1000));
        const contract = yield* fixture.run(
          Effect.flatMap(MutationCtx, (ctx) =>
            Effect.promise(() =>
              ctx.db.insert("billingGrants", {
                product: "pro",
                userId: fixture.users.admin.userId,
                source: { kind: "contract", contractId: "contract-reminder" },
                validFrom: TENANCY_NOW,
                validTo: PASS_END,
              })
            )
          )
        );
        const deleting = yield* fixture.run(
          grantPass(fixture.users.teacher.userId, PASS_END)
        );
        const school = yield* fixture.run(
          Effect.flatMap(MutationCtx, (ctx) =>
            Effect.promise(() =>
              ctx.db.insert("billingGrants", {
                product: "school",
                tenantId: fixture.tenants.nf,
                scope: { kind: "tenant" },
                seats: 1,
                ninaSeats: 1,
                source: { kind: "contract", contractId: "contract-school" },
                validFrom: TENANCY_NOW,
                validTo: PASS_END,
              })
            )
          )
        );
        const removed = yield* fixture.run(
          grantPass(fixture.users.student.userId, PASS_END)
        );
        const placeholder = yield* fixture.run(
          grantPass(fixture.users.counselor.userId, PASS_END)
        );
        const gone = yield* fixture.run(
          grantPass(fixture.users.stranger.userId, PASS_END)
        );
        yield* fixture.run(
          Effect.flatMap(MutationCtx, (ctx) =>
            Effect.promise(async () => {
              await ctx.db.patch(fixture.users.teacher.userId, {
                deletionPreparedAt: TENANCY_NOW,
              });
              await ctx.db.delete(removed);
              await ctx.db.patch(fixture.users.counselor.userId, {
                email: loginAddress("konselor"),
              });
              await ctx.db.delete(fixture.users.stranger.userId);
            })
          )
        );
        const reads = yield* Effect.forEach(
          [first, contract, deleting, school, removed, placeholder, gone],
          (grantId) =>
            fixture.internal.query(readInput, { grantId, locale: "en" })
        );
        expect(reads).toEqual([null, null, null, null, null, null, null]);
      })
  );

  it.effect(
    "sends the reminder of one pass once to its owner, and nothing once a later pass extends it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const owner = fixture.users.owner.userId;
        const grantId = yield* fixture.run(grantPass(owner, PASS_END));
        const send = vi.spyOn(resend, "sendEmail");
        yield* fixture.internal.mutation(enqueue, { grantId, ...message });
        yield* fixture.internal.mutation(enqueue, { grantId, ...message });
        expect(send).toHaveBeenCalledTimes(2);
        expect(send.mock.calls[0]?.[1]).toMatchObject({
          ...message,
          idempotencyKey: `pass-reminder/${grantId}`,
          to: yield* fixture.run(emailOf(owner)),
        });
        yield* fixture.run(grantPass(owner, PASS_END + 1000));
        yield* fixture.internal.mutation(enqueue, { grantId, ...message });
        expect(send).toHaveBeenCalledTimes(2);
      })
  );

  it.effect(
    "renders the day the pass ends in the learner's language and sends it, and sends nothing for a reminder that no longer applies",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(signedPages);
        const owner = fixture.users.owner.userId;
        const grantId = yield* fixture.run(grantPass(owner, PASS_END));
        const send = vi.spyOn(resend, "sendEmail");
        yield* fixture.internal.action(deliver, { grantId, locale: "en" });
        const sent = send.mock.calls[0]?.[1];
        expect(sent?.subject).toBe(
          `Your Pro pass ends on ${new Intl.DateTimeFormat("en", {
            dateStyle: "long",
            timeZone: "Asia/Jakarta",
          }).format(PASS_END)}`
        );
        expect(sent?.html).toContain(
          "http://localhost:3000/en/user/settings/subscriptions"
        );
        yield* fixture.run(grantPass(owner, PASS_END + 1000));
        yield* fixture.internal.action(deliver, { grantId, locale: "en" });
        expect(send).toHaveBeenCalledOnce();
      })
  );
});
