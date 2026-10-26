import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { readLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { encodeArguments } from "@repo/backend/scripts/content/acceptance/member";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { encodeJsonText } from "@repo/utilities/json";
import { Clock, DateTime, Duration, Effect, Schema } from "effect";

/** What a learner seeds: a one-month pass, or the monthly plan with its first month paid. */
const XenditPurchase = Schema.Literals(["pass", "plan"]);

/** The answers of the checkout's prepare step and of the event inbox, as the Convex CLI prints them. */
const Prepared = Schema.fromJsonString(
  Schema.Struct({ accountId: Schema.String })
);
const Recorded = Schema.fromJsonString(
  Schema.Struct({ eventId: Schema.String })
);

/** One Xendit webhook body for an event, as Xendit posts it. */
function deliveryOf(event: string, data: object, now: number) {
  return {
    key: `acceptance:${event}:${now}`,
    payload: encodeJsonText({
      business_id: "acceptance",
      created: DateTime.formatIso(DateTime.makeUnsafe(now)),
      data,
      event,
    }),
    providerTime: now,
    rail: "xendit",
    type: event,
  };
}

/**
 * The Xendit webhook that completes one purchase: a paid pay session, which for
 * the monthly plan also saved the buyer's channel as a payment token.
 */
function deliveryOfPaid(
  purchase: typeof XenditPurchase.Type,
  sessionId: string,
  now: number
) {
  return deliveryOf(
    "payment_session.completed",
    {
      payment_id: `py_${sessionId}`,
      payment_session_id: sessionId,
      ...(purchase === "plan" ? { payment_token_id: `pt_${sessionId}` } : {}),
      reference_id: sessionId,
      session_type: "PAY",
      status: "COMPLETED",
    },
    now
  );
}

/**
 * Gives a learner of the running local acceptance backend a Xendit purchase the
 * way production records one: the checkout's own prepare and admit steps open
 * the Xendit account and the checkout, and the event inbox applies the webhook
 * Xendit would post once the learner paid. The monthly plan's recurring plan
 * then fails to open against the inert Xendit key, which leaves the paid month
 * to show, so a browser test sees a pass or a Xendit plan without a provider.
 */
export const seedAcceptanceXendit = Effect.fn("contentAcceptance.seedXendit")(
  function* (
    root: string,
    userId: string,
    purchase: typeof XenditPurchase.Type,
    now: number
  ) {
    const runtime = yield* readLocalRuntime(root);
    if (runtime === undefined) {
      return yield* acceptanceRuntimeError(
        "Run bun run acceptance:prepare and start acceptance before seeding a Xendit purchase."
      );
    }
    const run = (operation: string, path: string, args: object) =>
      encodeArguments(args).pipe(
        Effect.flatMap((text) =>
          runLocalConvex(runtime, operation, ["run", path, text])
        )
      );
    const offer = purchase === "pass" ? "pro.pass.1" : "pro.monthly";
    const sessionId = `ps_acceptance_${now}`;
    const { accountId } = yield* run(
      "xendit prepare",
      "billing/xendit/checkout:prepare",
      { offer, userId }
    ).pipe(Effect.flatMap(Schema.decodeEffect(Prepared)));
    yield* run("xendit admit", "billing/xendit/checkout:admit", {
      accountId,
      event: {
        name: "checkout started",
        properties: {
          checkout_locale: "en",
          customer_ip_available: false,
          locale: "en",
          product_count: 1,
          product_id: offer,
          rail: "xendit",
        },
      },
      locale: "en",
      offer,
      session: {
        expiresAt: now + Duration.toMillis(Duration.minutes(30)),
        sessionId,
        url: `https://checkout-staging.xendit.co/sessions/${sessionId}`,
      },
      userId,
    });
    const { eventId } = yield* run(
      "xendit event",
      "billing/events:record",
      deliveryOfPaid(purchase, sessionId, now)
    ).pipe(Effect.flatMap(Schema.decodeEffect(Recorded)));
    yield* run("xendit apply", "billing/events:apply", { eventId });
  }
);

/** The usage of the xendit mode: the learner's app user ID, then the purchase. */
const USAGE = "xendit <user-id> <pass|plan>";
const XenditArguments = Schema.Tuple([Schema.String, XenditPurchase]);

/**
 * The xendit mode of the acceptance command line: gives the learner it names
 * the purchase it names, as of the moment the command runs.
 */
export const xenditMode = {
  mode: "xendit",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runXendit")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [userId, purchase] = yield* decodeModeArguments(
      USAGE,
      XenditArguments,
      args
    );
    return yield* seedAcceptanceXendit(
      root,
      userId,
      purchase,
      yield* Clock.currentTimeMillis
    );
  }),
} satisfies AcceptanceMode;
