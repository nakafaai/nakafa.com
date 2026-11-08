import type { RunConvex } from "@repo/backend/scripts/content/acceptance/account";
import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { writeSessionCookie } from "@repo/backend/scripts/content/acceptance/learner";
import { readLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import {
  encodeArguments,
  openInvitedMember,
} from "@repo/backend/scripts/content/acceptance/member";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { Duration, Effect, Option, Schedule, Schema } from "effect";

/** The invite and the Person that the invite function wrote, as the Convex CLI prints them. */
const Invited = Schema.fromJsonString(
  Schema.Struct({ invite: Schema.String, person: Schema.String })
);
/** Whether the inbox holds the invitation's row, as the Convex CLI prints it. */
const HoldsRow = Schema.fromJsonString(Schema.Boolean);

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
/** How often the one row is read while the command waits for it. */
const ROW_READ_PAUSE = Duration.millis(250);

/**
 * Reads the inbox row of one invitation by the invite and the Person it names,
 * until it stands, and fails when it does not within `wait`.
 */
export const waitForInboxRow = Effect.fn("contentAcceptance.inboxRow")(
  function* <E, R>(
    run: RunConvex<E, R>,
    invited: { readonly invite: string; readonly person: string },
    wait: Duration.Input
  ) {
    const holdsRow = encodeArguments(invited).pipe(
      Effect.flatMap((args) =>
        run("inbox row", ["run", "tenancy/seed:invitation", args])
      ),
      Effect.flatMap(Schema.decodeEffect(HoldsRow))
    );
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
 * Invites one learner into a school that `school` opened, through the internal
 * invite path that the school's own invite mutation uses. The learner's account
 * holds the invited address, so it claims the invitation the way `owner` claims
 * the school for its Owner. The command waits until the inbox holds the row, and
 * then writes the learner's session cookie to `output`, mode 600, for a browser
 * test to send. An address that already holds an account signs that account in
 * again, so a learner invited to a second school keeps one inbox. An `expired`
 * invite ends before the account signs in, as its term ending does, so the claim
 * joins no school, and no inbox row is waited for.
 */
export const createAcceptanceInvite = Effect.fn("contentAcceptance.invite")(
  function* (
    root: string,
    slug: string,
    address: string,
    output: string,
    expired = false
  ) {
    const runtime = yield* readLocalRuntime(root);
    if (runtime === undefined) {
      return yield* acceptanceRuntimeError(
        "Run bun run acceptance:prepare and start acceptance before inviting a learner."
      );
    }
    const run = (
      operation: string,
      args: readonly string[],
      sensitiveValues?: readonly string[]
    ) => runLocalConvex(runtime, operation, args, sensitiveValues);
    const invited = yield* encodeArguments({
      email: address,
      locale: CONTENT_LOCALE,
      name: LEARNER_NAME,
      slug,
    }).pipe(
      Effect.flatMap((args) =>
        run("school invite", ["run", "tenancy/provision:invite", args])
      ),
      Effect.flatMap(Schema.decodeEffect(Invited))
    );
    if (expired) {
      yield* encodeArguments({ email: address, slug }).pipe(
        Effect.flatMap((args) =>
          run("invite expiry", ["run", "tenancy/seed:expired", args])
        )
      );
    }
    const token = yield* openInvitedMember(run, address);
    if (!expired) {
      yield* waitForInboxRow(run, invited, ROW_WAIT);
    }
    yield* writeSessionCookie(output, token);
  }
);

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
    return yield* createAcceptanceInvite(
      root,
      slug,
      address,
      output,
      state === "expired"
    );
  }),
} satisfies AcceptanceMode;
