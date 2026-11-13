import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  invoiceMode,
  payInvoice,
  seedXendit,
  xenditMode,
} from "@repo/backend/scripts/content/acceptance/xendit";
import { localConvexDouble } from "@repo/backend/test/acceptance";
import { nodePlatform } from "@repo/backend/test/platform";
import { Effect, Schema } from "effect";
import { TestClock } from "effect/testing";

const mocks = vi.hoisted(() => ({ layer: vi.fn() }));
vi.mock(
  "@repo/backend/scripts/content/acceptance/convex",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@repo/backend/scripts/content/acceptance/convex")
    >()),
    localConvexLayer: mocks.layer,
  })
);

const NOW = 1_800_000_000_000;
const INVOICE = {
  _id: "invoice-1",
  accountId: "account-1",
  dueAt: NOW + 86_400_000,
  number: "INV-2026-0001",
};
/** The pay session a checkout's admit step names. */
const Admitted = Schema.Struct({
  session: Schema.Struct({ sessionId: Schema.String }),
});

/** The key a webhook delivery carries to the inbox. */
const Delivered = Schema.Struct({ key: Schema.String });

/** What the local backend answers: an account for the checkout, an event for the inbox, and one invoice. */
const ANSWERS = {
  "_system/cli/tableData": {
    continueCursor: "",
    isDone: true,
    page: [INVOICE],
  },
  "billing/events:record": { eventId: "event-1" },
  "billing/xendit/checkout:prepare": { accountId: "account-1" },
};

describe("acceptance xendit", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "opens the checkout through its own steps and applies the webhook of a paid pass or of a plan's first month",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(NOW);
        const pass = localConvexDouble(ANSWERS);
        const plan = localConvexDouble(ANSWERS);

        yield* seedXendit("app-user-1", "pass").pipe(
          Effect.provide(pass.layer)
        );
        yield* seedXendit("app-user-1", "plan").pipe(
          Effect.provide(plan.layer)
        );

        expect(pass.paths()).toEqual([
          "billing/xendit/checkout:prepare",
          "billing/xendit/checkout:admit",
          "billing/events:record",
          "billing/events:apply",
        ]);
        expect(pass.argsOf("billing/xendit/checkout:prepare")).toEqual({
          offer: "pro.pass.1",
          userId: "app-user-1",
        });
        expect(pass.argsOf("billing/events:apply")).toEqual({
          eventId: "event-1",
        });
        expect(pass.argsOf("billing/events:record")).toMatchObject({
          type: "payment_session.completed",
        });
        expect(pass.argsOf("billing/events:record")).not.toMatchObject({
          payload: expect.stringContaining("payment_token_id"),
        });
        expect(plan.argsOf("billing/events:record")).toMatchObject({
          payload: expect.stringContaining("payment_token_id"),
        });
      })
  );

  it.effect(
    "gives two seeds of the same millisecond their own pay session and webhook key, so the inbox applies both",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(NOW);
        const first = localConvexDouble(ANSWERS);
        const second = localConvexDouble(ANSWERS);

        yield* seedXendit("app-user-1", "plan").pipe(
          Effect.provide(first.layer)
        );
        yield* seedXendit("app-user-2", "plan").pipe(
          Effect.provide(second.layer)
        );

        const sessionOf = (backend: typeof first) =>
          Schema.decodeUnknownSync(Admitted)(
            backend.argsOf("billing/xendit/checkout:admit")
          ).session.sessionId;
        const keyOf = (backend: typeof first) =>
          Schema.decodeUnknownSync(Delivered)(
            backend.argsOf("billing/events:record")
          ).key;
        expect(sessionOf(first)).not.toBe(sessionOf(second));
        expect(keyOf(first)).not.toBe(keyOf(second));
        expect(keyOf(first)).toBe(
          `acceptance:payment_session.completed:${sessionOf(first)}`
        );
      })
  );

  it.effect(
    "opens a school invoice's hosted payment as the session Xendit answers with, then applies the webhook of its payment",
    () =>
      Effect.gen(function* () {
        const opened = localConvexDouble(ANSWERS);
        const paid = localConvexDouble(ANSWERS);

        yield* payInvoice(INVOICE.number, "open").pipe(
          Effect.provide(opened.layer)
        );
        yield* payInvoice(INVOICE.number, "paid").pipe(
          Effect.provide(paid.layer)
        );

        expect(opened.argsOf("billing/xendit/invoice:record")).toEqual({
          accountId: INVOICE.accountId,
          expiresAt: INVOICE.dueAt,
          invoiceId: INVOICE._id,
          sessionId: `ps_acceptance_${INVOICE.number}`,
          url: `https://checkout-staging.xendit.co/sessions/ps_acceptance_${INVOICE.number}`,
        });
        expect(paid.paths()).toEqual([
          "billing/events:record",
          "billing/events:apply",
        ]);
      })
  );

  it.effect("pays nothing for an invoice the runtime does not hold", () =>
    Effect.gen(function* () {
      const backend = localConvexDouble(ANSWERS);

      expect(
        yield* payInvoice("INV-0000", "open").pipe(
          Effect.provide(backend.layer),
          Effect.flip
        )
      ).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: "The local runtime holds no invoice INV-0000.",
      });
      expect(backend.paths()).not.toContain("billing/xendit/invoice:record");
    })
  );

  it.effect("runs the purchase and the invoice step the modes name", () =>
    Effect.gen(function* () {
      const backend = localConvexDouble(ANSWERS);
      mocks.layer.mockReturnValue(backend.layer);

      yield* xenditMode.run("/root", ["app-user-1", "pass"]);
      yield* invoiceMode.run("/root", [INVOICE.number, "paid"]);

      expect(backend.paths()).toContain("billing/xendit/checkout:admit");
      expect(mocks.layer).toHaveBeenCalledWith("/root");
    }).pipe(Effect.provide(nodePlatform))
  );

  it.effect("refuses a purchase or a step the modes do not know", () =>
    Effect.gen(function* () {
      expect(
        yield* xenditMode.run("/root", ["app-user-1", "year"]).pipe(Effect.flip)
      ).toMatchObject({
        message: "Usage: acceptance xendit <user-id> <pass|plan>",
      });
      expect(
        yield* invoiceMode
          .run("/root", [INVOICE.number, "later"])
          .pipe(Effect.flip)
      ).toMatchObject({
        message: "Usage: acceptance invoice <invoice-number> <open|paid>",
      });
      expect(mocks.layer).not.toHaveBeenCalled();
    }).pipe(Effect.provide(nodePlatform))
  );
});
