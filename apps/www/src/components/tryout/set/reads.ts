import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import practice from "@repo/backend/confect/_generated/refs/practice";
import progress from "@repo/backend/confect/_generated/refs/progress";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { Duration, Effect, Option, Schema } from "effect";
import { setAttemptRequest } from "@/components/tryout/route/learner";
import { warmQuery } from "@/lib/convex/warm";

/** How long a press waits for a set's reads before the set opens anyway, as it does when they fail. */
const WARM_WAIT = Duration.seconds(1);

/** A running set attempt answers the bare address with a redirect naming its attempt ID. */
const RedirectAttemptSchema = Schema.Struct({
  attemptId: Schema.String,
  kind: Schema.Literal("redirect"),
});
const decodeRedirect = Schema.decodeUnknownOption(RedirectAttemptSchema);

/** The address a set's reads answer for: the set, the page's locale, and the attempt the address names. */
const SetAddressSchema = Schema.Struct({
  attemptId: Schema.UndefinedOr(Schema.String),
  locale: ActiveAppLocaleCodeSchema,
  set: Schema.Struct({
    countryKey: Schema.String,
    examKey: Schema.String,
    publicPath: Schema.String,
    setKey: Schema.String,
    trackKey: Schema.String,
  }),
});

type SetAddress = typeof SetAddressSchema.Type;

/**
 * The arguments of a learner's reads of a set, built in one place so the set's page and the warm before it
 * subscribe to the same queries: the learner's attempt the address names, or else their current one; what they
 * hold of the set's Stars; and the set's board, which places that same attempt.
 */
export function setReadArgs(address: SetAddress) {
  const { set } = address;
  const identity = {
    countryKey: set.countryKey,
    examKey: set.examKey,
    locale: address.locale,
    setKey: set.setKey,
    trackKey: set.trackKey,
  };
  return {
    attempt: {
      request: setAttemptRequest({
        attemptId: address.attemptId,
        keys: set,
        locale: address.locale,
        publicPath: set.publicPath,
      }),
    },
    board:
      address.attemptId === undefined
        ? identity
        : { ...identity, attemptId: address.attemptId },
    claims: identity,
    practice: {
      countryKey: set.countryKey,
      examKey: set.examKey,
      setKey: set.setKey,
      trackKey: set.trackKey,
    },
  };
}

/**
 * Warms a learner's reads of a set before its page opens (`warmQuery`): the attempt, how far they grew, their
 * Stars of the set, its board, and its practice progress, all at once, so the pane paints whole in its first
 * frame. When a bare set address answers with a redirect to a running attempt, its retained attempt and board are
 * warmed too so the redirect paints whole. A read that has not answered within `WARM_WAIT` lets the set open, and
 * the pane waits for it there.
 */
export const warmSetReads = Effect.fn("tryout.set.warmReads")(function* (
  address: SetAddress
) {
  const args = setReadArgs(address);
  yield* Effect.gen(function* () {
    const [attempt] = yield* Effect.all(
      [
        warmQuery(tryouts.queries.attemptPage.getSet, args.attempt),
        warmQuery(progress.queries.growth, {}),
        warmQuery(progress.queries.claims, args.claims),
        warmQuery(tryouts.queries.ranks.bySet, args.board),
        warmQuery(practice.sessions.summary, args.practice),
      ],
      { concurrency: "unbounded" }
    );
    if (address.attemptId !== undefined) {
      return;
    }
    const redirect = Option.flatMap(attempt, decodeRedirect);
    if (Option.isNone(redirect)) {
      return;
    }
    const redirected = setReadArgs({
      ...address,
      attemptId: redirect.value.attemptId,
    });
    yield* Effect.all(
      [
        warmQuery(tryouts.queries.attemptPage.getSet, redirected.attempt),
        warmQuery(tryouts.queries.ranks.bySet, redirected.board),
      ],
      { concurrency: "unbounded", discard: true }
    );
  }).pipe(Effect.timeoutOption(WARM_WAIT));
});
