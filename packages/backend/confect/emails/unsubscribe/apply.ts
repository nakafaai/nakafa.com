import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { Recipient } from "@repo/backend/confect/emails/unsubscribe/schema";
import { suppressedAddress } from "@repo/backend/confect/emails/unsubscribe/token";
import {
  ACCOUNT_RELATIONS,
  canSwitchOff,
  NOTICE_RULES,
  NoticeKind,
} from "@repo/backend/confect/notifications/rules";
import {
  accountSwitchedOff,
  moveSwitch,
  switchedOff,
} from "@repo/backend/confect/notifications/switched";
import { Array as Arr, Clock, Effect, Match, Option } from "effect";

/**
 * The kinds that email an account (`accounts`) or a Person of a school, and whose email a person may switch off: an
 * invitation's email is always sent, so no switch holds it.
 */
const emailKinds = (accounts: boolean) =>
  Arr.filter(
    NoticeKind.literals,
    (kind) =>
      canSwitchOff(kind, "email") &&
      Arr.some(
        NOTICE_RULES[kind].routes,
        (route) =>
          route.email !== undefined &&
          Arr.contains(ACCOUNT_RELATIONS, route.relation) === accounts
      )
  );

/**
 * Stops the email Nakafa sends a recipient on its own: an account and a Person switch the email of every kind they
 * receive off, as their notification settings do, so a switch turned back on there is the way back; an address that
 * holds neither is kept in `emailSuppressions`, which the invitation's sender reads. Repeating it changes nothing.
 * Mail the reader asks for, a guardian's sign-in code, and notices of their own payment still arrive.
 */
export const applyUnsubscribe = Effect.fn("emails.unsubscribe.apply")(
  function* (recipient: typeof Recipient.Type) {
    yield* Match.valueTags(recipient, {
      Account: ({ userId }) =>
        Effect.forEach(
          emailKinds(true),
          (kind) =>
            Effect.flatMap(accountSwitchedOff(userId, kind, "email"), (found) =>
              moveSwitch(found, false, { channel: "email", kind, userId })
            ),
          { discard: true }
        ),
      Address: ({ address }) => suppress(suppressedAddress(address)),
      Person: ({ personId, tenantId }) =>
        Effect.forEach(
          emailKinds(false),
          (kind) =>
            Effect.flatMap(switchedOff(personId, kind, "email"), (found) =>
              moveSwitch(found, false, {
                channel: "email",
                kind,
                personId,
                tenantId,
              })
            ),
          { discard: true }
        ),
    });
  }
);

/** Whether an address asked Nakafa to send it nothing more on its own. */
export const isSuppressed = Effect.fn("emails.unsubscribe.isSuppressed")(
  function* (address: string) {
    return Option.isSome(yield* suppressionOf(suppressedAddress(address)));
  }
);

/** The suppression of a normalized address, if it holds one. */
const suppressionOf = Effect.fn("emails.unsubscribe.suppressionOf")(function* (
  address: string
) {
  return yield* (yield* DatabaseReader)
    .table("emailSuppressions")
    .index("by_address", (query) => query.eq("address", address))
    .first()
    .pipe(Effect.orDie);
});

/** Keeps a normalized address among the suppressed ones, once. */
const suppress = Effect.fn("emails.unsubscribe.suppress")(function* (
  address: string
) {
  if (Option.isSome(yield* suppressionOf(address))) {
    return;
  }
  yield* (yield* DatabaseWriter)
    .table("emailSuppressions")
    .insert({ address, createdAt: yield* Clock.currentTimeMillis })
    .pipe(Effect.orDie);
});
