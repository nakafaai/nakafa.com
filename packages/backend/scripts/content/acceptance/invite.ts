import {
  openLearnerAccount,
  type RunConvex,
} from "@repo/backend/scripts/content/acceptance/account";
import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import {
  SESSION_LIFETIME,
  writeSessionCookie,
} from "@repo/backend/scripts/content/acceptance/learner";
import { readLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { JsonTextSchema } from "@repo/utilities/json";
import {
  Array as Arr,
  Duration,
  Effect,
  Option,
  Schedule,
  Schema,
} from "effect";

/** The Person that the invite function wrote, as the Convex CLI prints it. */
const InvitedPerson = Schema.fromJsonString(
  Schema.Struct({ person: Schema.String })
);
/** The app users of the local runtime, as the Convex CLI prints them. */
const UserRows = Schema.fromJsonString(
  Schema.Array(Schema.Struct({ _id: Schema.String, authId: Schema.String }))
);
/** The inbox rows of the local runtime, as the Convex CLI prints them. */
const InboxRows = Schema.fromJsonString(
  Schema.Array(Schema.Struct({ recipientPersonId: Schema.String }))
);
/** One Convex function's arguments as the CLI takes them, JSON text. */
const encodeArguments = Schema.encodeEffect(JsonTextSchema);

/** The name of the learner the command invites, as the other acceptance accounts name theirs. */
const LEARNER_NAME = "Acceptance Learner";
/** The content language of the schools that `school` opens, which the invitation email is written in. */
const CONTENT_LOCALE = "id";
/**
 * How long the inbox may take to hold the invited row. The inbox reads an entry
 * only after it has settled, five seconds after it is written (ADR 0027), so the
 * row comes after that and the consumer's run.
 */
const ROW_WAIT = Duration.seconds(30);

/**
 * Reads the inbox rows of the local runtime once a second until one of them
 * belongs to `person`, and fails when none does within `wait`.
 */
export const waitForInboxRow = Effect.fn("contentAcceptance.inboxRow")(
  function* <E, R>(run: RunConvex<E, R>, person: string, wait: Duration.Input) {
    const holdsRow = run("inbox rows", [
      "data",
      "notifications",
      "--format",
      "jsonArray",
      "--limit",
      "1000",
    ]).pipe(
      Effect.flatMap(Schema.decodeEffect(InboxRows)),
      Effect.map(Arr.some((row) => row.recipientPersonId === person))
    );
    const found = yield* holdsRow.pipe(
      Effect.repeat({
        schedule: Schedule.spaced(Duration.seconds(1)),
        until: (ok) => ok,
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
 * again, so a learner invited to a second school keeps one inbox.
 */
export const createAcceptanceInvite = Effect.fn("contentAcceptance.invite")(
  function* (root: string, slug: string, address: string, output: string) {
    const runtime = yield* readLocalRuntime(root);
    if (runtime === undefined) {
      return yield* acceptanceRuntimeError(
        "Run pnpm acceptance:prepare and start acceptance before inviting a learner."
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
      Effect.flatMap(Schema.decodeEffect(InvitedPerson))
    );
    const account = yield* openLearnerAccount(run, SESSION_LIFETIME, address);
    const users = yield* run("app users", [
      "data",
      "users",
      "--format",
      "jsonArray",
      "--limit",
      "1000",
    ]).pipe(Effect.flatMap(Schema.decodeEffect(UserRows)));
    const learner = Arr.findFirst(
      users,
      (user) => user.authId === account.userId
    );
    if (Option.isNone(learner)) {
      return yield* acceptanceRuntimeError(
        "The new learner account has no app user to claim the invitation with."
      );
    }
    yield* encodeArguments({ cursor: null, userId: learner.value._id }).pipe(
      Effect.flatMap((args) =>
        run("learner claim", ["run", "tenancy/claims:run", args])
      )
    );
    yield* waitForInboxRow(run, invited.person, ROW_WAIT);
    yield* writeSessionCookie(output, account.token);
  }
);
