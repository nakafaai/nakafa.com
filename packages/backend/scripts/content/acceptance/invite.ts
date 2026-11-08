import {
  LocalConvex,
  localConvexLayer,
  type RunConvex,
} from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import {
  SessionCookie,
  writeFixture,
} from "@repo/backend/scripts/content/acceptance/fixture";
import { seedInvitedMember } from "@repo/backend/scripts/content/acceptance/member";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { Duration, Effect, Option, Schedule, Schema } from "effect";

/** The invite and the Person that the invite function wrote. */
const Invited = Schema.Struct({ invite: Schema.String, person: Schema.String });

/** The name of the learner the command invites, as the other acceptance accounts name theirs. */
const LEARNER_NAME = "Acceptance Learner";
/** The content language of the schools that `school` opens, which the invitation email is written in. */
const CONTENT_LOCALE = "id";
/**
 * How long the inbox may take to hold the invited row. The invite schedules the
 * inbox consumer at once, and the consumer handles an entry that has not settled
 * yet while it has room (ADR 0027), so the row usually stands before the first
 * read; a loaded backend runs the consumer later.
 */
const ROW_WAIT = Duration.seconds(30);
/** How often the one row is read while the invite waits for it. */
const ROW_READ_PAUSE = Duration.millis(250);

/**
 * Reads the inbox row of one invitation by the invite and the Person it names,
 * until it stands, and fails when it does not within `wait`.
 */
export const waitForInboxRow = Effect.fn("contentAcceptance.inboxRow")(
  function* <E, R>(
    run: RunConvex<E, R>,
    invited: typeof Invited.Type,
    wait: Duration.Input
  ) {
    const holdsRow = run("inbox row", {
      args: invited,
      path: "tenancy/seed:invitation",
    }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Schema.Boolean)));
    const found = yield* holdsRow.pipe(
      Effect.repeat({
        schedule: Schedule.spaced(ROW_READ_PAUSE),
        until: (held) => held,
      }),
      Effect.timeoutOption(wait)
    );
    if (Option.isNone(found)) {
      return yield* acceptanceRuntimeError(
        "The inbox did not hold the invitation in time."
      );
    }
  }
);

/**
 * Invites one learner into a school that `seedSchool` opened, through the
 * internal invite path that the school's own invite mutation uses, and answers
 * the learner's session cookie once the inbox holds the invitation. The
 * learner's account holds the invited address, so it claims the invitation the
 * way `seedOwner` claims the school for its Owner. An address that already holds
 * an account signs that account in again, so a learner invited to a second
 * school keeps one inbox. An `expired` invite ends before the account signs in,
 * as its term ending does, so the claim joins no school, and no inbox row is
 * waited for.
 */
export const seedInvite = Effect.fn("contentAcceptance.seedInvite")(function* (
  slug: string,
  address: string,
  expired = false
) {
  const { run } = yield* LocalConvex;
  const invited = yield* run("school invite", {
    args: { email: address, locale: CONTENT_LOCALE, name: LEARNER_NAME, slug },
    path: "tenancy/provision:invite",
  }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Invited)));
  if (expired) {
    yield* run("invite expiry", {
      args: { email: address, slug },
      path: "tenancy/seed:expired",
    });
  }
  const cookie = yield* seedInvitedMember(address);
  if (!expired) {
    yield* waitForInboxRow(run, invited, ROW_WAIT);
  }
  return cookie;
});

/**
 * The usage of the invite mode: the school, the learner's address, the file for the session cookie, then
 * `expired` for an invite whose term has ended.
 */
const USAGE = "invite <school-slug> <learner-address> <cookie-file> [expired]";
const InviteArguments = Schema.Tuple([
  Schema.String,
  Schema.String,
  Schema.String,
  Schema.optionalKey(Schema.Literal("expired")),
]);

/**
 * The invite mode of the acceptance command line: invites the learner at the
 * address into the school that the command names, signs the learner in, and writes
 * the learner's session cookie to the file that the command names. `expired` ends
 * the invite first, so the learner signs in as no member of the school.
 */
export const inviteMode = {
  mode: "invite",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runInvite")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [slug, address, output, state] = yield* decodeModeArguments(
      USAGE,
      InviteArguments,
      args
    );
    const cookie = yield* seedInvite(slug, address, state === "expired").pipe(
      Effect.provide(localConvexLayer(root))
    );
    yield* writeFixture(output, SessionCookie, cookie);
  }),
} satisfies AcceptanceMode;
